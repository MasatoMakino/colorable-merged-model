# FastEdgesGeometry: WASM and worker-pool feasibility

Date: 2026-10-18. Baseline: `main` at `f13361c` (Stage 4 `FastEdgesGeometry`).

## Questions

1. Can `FastEdgesGeometry` run in parallel with WASM?
2. Including every memory transfer, does the parallel WASM path beat the JS path in total time?
3. Does an unbounded number of WASM instances lose to startup cost, and what instance control works?
4. Can a size threshold route each geometry to the main thread or the pool, with both running together?

## Answers

1. Yes. Each worker owns one WASM instance, so the design needs no `SharedArrayBuffer` and no COOP/COEP headers. Every output is bit-identical to `src`, including segment order.
2. Yes, on the target workload. In the same batch, two WASM workers finish in 219 ms cold against 351 ms for the main-thread JS path (1.6x). Main-thread occupation drops from one 351 ms task to about 30 ms in short slices. A pool that is spawned and reserves memory while assets load finishes edge generation in 148 ms. Loading slows by about 40 ms, so asset loading plus edge generation takes 693 ms against 873 ms for JS and 730 ms for the pool without reserve (see "Prewarm during asset loading").
3. Yes. One worker per part (78 workers) takes 422 ms cold, which is slower than plain JS. Startup takes 322 ms of that time. A pool of two workers is optimal for this dataset because the largest part is the critical path.

4. Yes. `HybridEdgeBuilder` keeps every output bit-identical and recovers the loss of the pool on tiny geometries (20 ms against 67 ms for 1,000 boxes). It does not beat a pool with free workers, and a high threshold blocks the main thread. Keep the threshold low (about 256 triangles), slice the main-thread share, and prewarm. See "Hybrid routing".

Many small parts invert the result. For 1,000 separate boxes, the pool takes 60-100 ms against 10.6 ms on the main thread, because per-message overhead dominates. Route only large geometries to the pool.

## Setup

- Chrome 155, macOS, Intel CPU with `navigator.hardwareConcurrency` = 6. Measured through Chrome DevTools MCP.
- Each run opens a fresh iframe: cold JIT, no workers, no compiled module. The controller interleaves conditions, rotates the start each round, and runs 5 rounds. Tables show medians. "Cold" is the first run in the iframe (5 samples). "Warm" is runs 2-4 on the same instance or pool (15 samples).
- Real dataset (anonymized): 3 Draco GLB files, 78 meshes, 694,001 triangles. The largest mesh has 382,200 triangles (55%). Thresholds are 0.25 degrees for 3 categories and 7 degrees for the rest. The application loader calls `GeometryMerger.add` for all meshes in one `Promise.all`, and the benchmark submits them the same way. One more mesh (1,074 triangles) belongs to a category that the application does not merge, so the benchmark excludes it as the application does.
- Synthetic: `boxes1000` is 1,000 separate `BoxGeometry` (per-source path). `sphere` is one `SphereGeometry(1, 512, 512)` (523k triangles).

## Implementations

| Id | Path |
| --- | --- |
| A | `src/FastEdgesGeometry.ts` on the main thread (baseline) |
| B | WASM port on the main thread, one instance |
| C | `EdgeWorkerPool` with the three.js-free JS core in each worker |
| D | `EdgeWorkerPool` with one WASM instance in each worker |

The WASM port is AssemblyScript 0.28 (`-O3 --runtime stub --disable simd`, 3.3 kB). It is a direct port of Stage 4. It keeps the dot-product convention (`float64 x fround`), the pairing semantics, and the emission order. JS `Math.round` ties are reproduced explicitly because `f64.nearest` rounds ties to even. The module emits no FMA or SIMD.

## Correctness

`verifyNode.ts` (Node) and `bench.html?verify=1` (Chrome) compare raw bits with `src`. The comparison passes on every real mesh and on the synthetic cases: Uint16 and Uint32 indices, non-indexed input, 0.25-degree threshold, and chunked calls. It also passes for the JS and WASM pools under both LPT and FIFO scheduling.

## Decision rule (fixed before measuring)

1. If B is not faster than A on the largest mesh, drop WASM and evaluate C only.
2. Judge by wall time to all edges ready on the real dataset, against A.
3. Report main-thread occupation as a secondary metric.

Rule 1 passed. On the largest mesh, B took 161 ms cold and 108 ms warm. A took 212 ms cold and 199 ms warm.

## Real dataset

| Condition | Cold wall | Warm wall | Main thread (cold) | Largest task (cold) | Retained WASM memory |
| --- | ---: | ---: | ---: | ---: | ---: |
| A JS main | 351 | 270 | 351 (one task) | 212 | - |
| B WASM main | 272 | 194 | 270 (one task) | 161 | 139 MB |
| C JS pool, 2 | 236 | 214 | 30 | 214 | - |
| C JS pool, 4 | 255 | 220 | 30 | 228 | - |
| D WASM pool, 1 | 297 | 222 | 28 | 165 | 139 MB |
| D WASM pool, 2 | 219 | 142 | 28 | 172 | 158 MB |
| D WASM pool, 3 | 217 | 145 | 32 | 171 | - |
| D WASM pool, 4 | 226 | 144 | 30 | 175 | 194 MB |
| D WASM pool, 6 (hc) | 229 | 147 | 31 | 175 | 213 MB |
| D WASM pool, 78 (one per mesh) | 422 | 159 | 37 | 300 | 250-438 MB |
| D pool 2, prewarm | 214 | 140 | 30 | 180 | 158 MB |
| D pool 2, prewarm + reserve | 139 | 139 | 27 | 114 | 278 MB |
| D pool 4, prewarm + reserve | 147 | 144 | 30 | 119 | 555 MB |

Times are in ms. Each table section comes from its own 5-round batch, so A and D pool 2 differ by up to 3% between batches (A cold: 351, 352, 359). The reserve rows come from a batch whose A cold was 359.

Main-thread figures for the pools are the sum of short slices: slicing, posting, receiving, and wrapping results. The longest frame gap during a pool run was 33 ms (one dropped frame), against a single 351 ms task for A.

### Transfer overhead (D pool 4, cold, sum over 78 meshes)

| Layer | Thread | Cost |
| --- | --- | ---: |
| `slice()` of the input and `postMessage` with transfer | main | 17 ms |
| Structured clone instead of slice + transfer | main | 30 ms, and wall +19 ms |
| Copy into WASM linear memory | worker | 15 ms cold, 4 ms warm |
| Copy out of linear memory | worker | 10 ms |
| Output back to main | - | zero-copy transfer |

The copies are small next to the computation. The cold path is dominated by first-touch page faults in fresh linear memory, which the next section analyzes.

## Cold penalty: first-touch memory, not tier-up

The WASM computation runs about 40% slower in the first run (sphere: 162 ms cold, 119 ms warm). Two hypotheses were tested on B with a prewarmed module (sphere, 5 rounds):

| Variant | Cold compute |
| --- | ---: |
| none | 169 |
| chunked calls (4k-64k triangles per call) | 159-162 |
| 200 untimed warm-up calls on a small mesh | 163 |
| pages pre-touched (grow and fill memory before the run) | **118** |

The baseline-to-optimizing tier-up hypothesis is rejected. First-touch page faults of about 135 MB explain the gap. On the real dataset, pre-touching lowers B from 276 ms to 193 ms cold.

In the pool, `reserve` grows and touches memory during `prewarm()`. Reserving for the largest mesh takes 84-117 ms. Asset loading (GLB fetch and Draco decode) takes about 510 ms, so the reservation fits in the loading time. The cost is retained memory: each reserving worker holds about 139 MB.

## Prewarm during asset loading

The rows above run `prewarm()` before loading starts and leave its time out of the wall time. A further batch started the pool together with asset loading (`start=concurrent`). The reserve size is a configured hint because the pool starts before any mesh is loaded. The batch ran 5 rounds and reports medians in ms.

| Condition | Asset loading | Prewarm (concurrent) | Edge generation | Loading + edges |
| --- | ---: | ---: | ---: | ---: |
| A JS main | 509 | - | 364 | 873 |
| D pool 2, cold | 515 | - | 215 | 730 |
| D pool 2, spawned during loading | 519 | 35 | 208 | 727 |
| D pool 2, spawned and reserved during loading | 545 | 152 | 148 | **693** |
| D pool 2, prewarm + reserve before loading | 505 | 97 (sequential) | 146 | 748 |

Prewarm finishes inside the loading window, but the reservation competes with Draco decoding and slows loading by about 40 ms. The net end-to-end gain of the reserve is therefore about 37 ms over the cold pool, not the 70 ms seen in edge generation alone. On a client where assets load faster than the prewarm, the hidden window shrinks.

## Pool control experiments

- **Size.** Wall time stops falling at 2 workers. The largest mesh (55% of the triangles) is the critical path. With LPT, a second worker absorbs the rest. Each extra worker adds contention and retained memory without reducing wall time.
- **Unbounded.** 78 workers take 322 ms from the first spawn until all report ready. Even with prewarm, wall time is no better than 2 workers. Retained memory is the highest of all conditions.
- **Prewarm.** Spawning before the run saves about 10 ms. Adding `reserve` saves about 75 ms more.
- **Scheduling.** LPT and FIFO tie cold (225 ms). Warm, LPT wins (144 ms against 201 ms). Under FIFO, the largest task copies in for 12 ms instead of 4 ms and computes for 160 ms instead of 119 ms. This matches first-touch on a worker whose memory has not grown to that size.
- **Module sharing.** Compiling once on the main thread and posting the `WebAssembly.Module` ties with per-worker compilation (226 ms). The module is 3.3 kB.
- **JS pool (C).** C beats A cold (236 ms at 2 workers), mostly through parallelism and freeing the main thread. D is 17 ms faster cold (2 workers), 72 ms faster warm, and 92 ms faster with prewarm + reserve.

## Workload regimes

| Workload | A cold | B cold | D pool 4 cold | Note |
| --- | ---: | ---: | ---: | --- |
| 1,000 small boxes | 10.6 | 9.6 | 75 (63 prewarm) | Per-message overhead dominates. Keep small geometries on the main thread. |
| 1 sphere, 523k triangles | 209 | 173 | 180 | No parallelism. The gain is per-core speed plus a free main thread. |
| Real dataset | 351 | 272 | 226 | Both gains apply. |

## Hybrid routing: main thread and pool together

`HybridEdgeBuilder` sends a geometry to the pool when its triangle count exceeds a threshold, and builds it on the main thread with `src` otherwise. It collects the submissions of one macrotask, posts every large task first, and then runs the small tasks. The modes differ in how the main thread runs them:

- `batch` runs all small tasks in one synchronous block.
- `sliced` yields every 8 ms.
- `immediate` (control) runs each small task on arrival.

The hybrid pool dispatches directly and compiles the module in each worker, so the first dispatch to each worker is posted synchronously. Later dispatches to a busy pool happen when a result arrives, which needs a main-thread turn. Every mode is bit-identical to `src` on the real and mixed workloads.

Before measuring, the break-even size was estimated at 110-250 triangles per task. The estimate divides 60-100 us of per-task pool overhead by 0.4-0.55 us per triangle on the main thread. Two objectives were fixed: (i) minimum wall time, and (ii) no synchronous main-thread stretch above 8 ms.

The `mixed` workload is 100 subdivided boxes (2k-8k triangles each, 460k in total) plus the 523k-triangle sphere. The main-thread cost of the boxes is close to the worker cost of the sphere.

Cold medians in ms (5 rounds, 2 workers unless noted). "Max sync" is the longest synchronous stretch of main-thread work.

| Workload | Condition | Wall | Main thread | Max sync | Main / worker tasks |
| --- | --- | ---: | ---: | ---: | --- |
| `boxes1000` | A JS main | 10.9 | 10.9 | 10.9 | 1000 / 0 |
| `boxes1000` | Pool only (threshold 0) | 67.3 | 51.6 | 5.9 | 0 / 1000 |
| `boxes1000` | Hybrid, threshold 64, batch | 20.4 | 11.9 | 10.5 | 1000 / 0 |
| `boxes1000` | Hybrid, threshold 64, sliced | 20.2 | 11.9 | 8.0 | 1000 / 0 |
| Real | A JS main | 361 | 361 | 361 | 78 / 0 |
| Real | Pool only (threshold 0) | 214 | 49 | 0.8 | 0 / 78 |
| Real | Hybrid, threshold 64, batch | 197 | 48 | 2.6 | 27 / 51 |
| Real | Hybrid, threshold 256, batch | 202 | 54 | 6.9 | 46 / 32 |
| Real | Hybrid, threshold 16k, batch | 230 | 70 | 28.8 | 70 / 8 |
| Real | Hybrid, threshold 16k, sliced | 227 | 68 | 13.7 | 70 / 8 |
| Real | Hybrid, threshold 64k, batch | 387 | 189 | 157 | 77 / 1 |
| Real | Hybrid, threshold 16k, 1 worker | 287 | 70 | 27.1 | 70 / 8 |
| Real | Hybrid, threshold 1024, immediate (control) | 207 | 53 | 13.6 | 59 / 19 |
| Real | Hybrid, threshold 16k, immediate (control) | 235 | 73 | 43.1 | 70 / 8 |
| Mixed | A JS main | 308 | 308 | 308 | 101 / 0 |
| Mixed | Pool only, 2 workers | 193 | 27 | 0.8 | 0 / 101 |
| Mixed | Pool only, 3 workers | 170 | 27 | 0.8 | 0 / 101 |
| Mixed | Hybrid, threshold 4096, batch | 244 | 75 | 53 | 44 / 57 |
| Mixed | Hybrid, threshold 4096, sliced | 211 | 78 | 10.5 | 44 / 57 |
| Mixed | Hybrid, threshold 16k, batch | 284 | 110 | 94 | 100 / 1 |
| Mixed | Hybrid, threshold 16k, sliced | 220 | 108 | 10.0 | 100 / 1 |
| Mixed | Hybrid, threshold 4096, immediate (control) | 224 | 76 | 64.6 | 44 / 57 |
| Mixed | Hybrid, threshold 16k, immediate (control) | 282 | 107 | 102 | 100 / 1 |

The same mixed conditions with a prewarmed pool:

| Condition | Wall (prewarmed) | Warm wall |
| --- | ---: | ---: |
| Pool only, 2 workers | 184 | 129 |
| Pool only, 3 workers | 158 | 111 |
| Hybrid, threshold 4096, batch | 194 | 129 |
| Hybrid, threshold 4096, sliced | 174 | 110 |
| Hybrid, threshold 16k, batch | 196 | 128 |
| Hybrid, threshold 16k, sliced | 197 | 110 |

Findings:

- **Tiny geometries.** The hybrid recovers most of the loss of the pool. It takes 20 ms against 67 ms for the pool and 11 ms for plain JS. The main-thread counters account for 11.9 ms of the 20.4 ms. The remaining time is unaccounted main-thread overhead, likely promise handling, and is not measured.
- **Real dataset.** Thresholds of 64-16k triangles give 197-230 ms, close to the pool only (214 ms). Most meshes are tiny: 46 of 78 have 256 triangles or fewer, but they hold only 3,500 triangles in total. A threshold of 64k sends seven meshes of 16k-64k triangles to the main thread and takes 387 ms, slower than plain JS.
- **Cold workers wait for the main thread.** In the mixed workload, a batch of about 94 ms on the main thread delays cold worker startup by the same amount (284 ms against 193 ms). Slicing brings it back to 220 ms. With a prewarmed pool, the batch penalty disappears (196 ms). The prediction "no batch penalty after prewarm" held, so worker startup needs main-thread turns. Refill of a busy pool also needs a main-thread turn, so a long batch can starve the workers in warm runs too.
- **The main thread as an extra worker.** Hybrid wall time beats the pool only when the workers are saturated, which occurred only in warm runs (110 ms against 129 ms). A third worker gives the same gain (111 ms) without blocking the main thread. When the workers have spare capacity, moving work to the main thread does not shorten the critical path.
- **Break-even.** 12-triangle tasks are faster on the main thread. 2k-8k-triangle tasks are faster in the pool. The 110-250 estimate lies between, and the real dataset is insensitive to thresholds between 64 and 256 (197-202 ms). The data does not pin the break-even more precisely.
- **Large-first posting is insurance, not a cold-path gain.** The `immediate` control runs small tasks on arrival without the batch tick. On the real dataset at threshold 1024, the control is faster cold (207 ms against 226 ms), and batch is faster warm (115 ms against 173 ms). In GLB order, the largest mesh arrives after many small ones, so the control delays it. In the mixed workload, the sphere arrives first, so arrival order is already large-first. There, the control is faster in both runs (224 ms against 244 ms cold, 106 ms against 122 ms warm). Batch mode carries 15-20 ms of overhead over the control in the mixed workload, and this overhead is not isolated.
- **Objective (ii).** On the real dataset, batch mode stays within 8 ms up to a threshold of 256 (6.9 ms). Sliced mode cannot split one task, so one 16k-64k-triangle mesh on the main thread can exceed the budget alone.

## Recommendation

1. Route by size with a low threshold, about 256 triangles. Small geometries stay on the main thread, and the rest go to the pool. Use the threshold to avoid per-message overhead, not to use the main thread as a worker. Run the main-thread share in slices and prewarm the pool, because cold workers wait for the main thread.
2. Use a bounded pool. Default to 2 workers with `min(2, hardwareConcurrency - 1)` and slice + transfer input. Add workers instead of raising the threshold when many medium geometries saturate the pool (mixed workload: 3 workers 158 ms against 184 ms). Compile the module in each worker when the main thread is busy right after dispatch.
3. Prewarm during asset loading. Make `reserve` opt-in because it trades about 139 MB per reserving worker for about 75 ms. Reserving on one worker and routing the largest geometry to it bounds the cost to one instance. This variant is not measured.
4. Terminate the workers after the last construction, or keep them only while further loads are expected. Linear memory only grows, so an idle pool keeps its peak footprint.
5. Splitting the largest mesh across workers is the only route past the critical path. The largest task accounts for about 82% of the best wall time. This work was deferred and is not measured here.

## Integration points (not implemented)

- `EdgeGeometryMerger.convert` is already async, and callers that use `Promise.all` need no change.
- Pool completion order differs from submission order. `GeometryMerger.add` pushes in completion order, so the merged layout changes unless the merger reserves a slot per call.
- Shipping a worker and a `.wasm` file in the npm package needs bundler-compatible URLs (`new URL(..., import.meta.url)`). Compatibility with Vite and webpack consumers is not verified.

## Limitations

- One machine and one browser. iPad Safari, a target device, is not measured. Worker spawn cost and WASM performance can differ there.
- The `longtask` observer missed some first runs. Main-thread blocking for A and B uses their synchronous wall time instead.
- Cross-thread timestamps use `timeOrigin + now()`, which is coarse without cross-origin isolation. Transit sums are approximate and can go negative on sub-millisecond tasks.
- The pool is a benchmark prototype and handles no worker errors beyond rejecting the running task.

## Reproduce

1. Run `devcontainer exec --workspace-folder . bash benchmark/wasm/build.sh`. The script builds into `docs/demo/_bench/`, which Git ignores.
2. Run `devcontainer exec --workspace-folder . node benchmark/wasm/build/verifyNode.mjs benchmark/wasm/build/edges.wasm` after bundling `verifyNode.ts` with esbuild.
3. Serve `docs/demo` (for example, `npx browser-sync ./docs/demo --port 3000`). Then open `_bench/controller.html?rounds=5&conds=impl=A|impl=D%26workers=2&common=workload=sphere`.
4. To use real data, place the GLB files, the Draco decoder (`draco/`), and a `dataset.json` in `docs/demo/_local/`, which Git ignores. `dataset.json` follows the `LocalDataset` interface in `bench.ts`. Then add `&common=workload=real` to the controller URL. Results are on `window.__bench.results`. Raw results of this round are in `results/`.
