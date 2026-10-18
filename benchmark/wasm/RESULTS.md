# FastEdgesGeometry: WASM and worker-pool feasibility

Date: 2026-10-18. Baseline: `main` at `f13361c` (Stage 4 `FastEdgesGeometry`).

## Questions

1. Can `FastEdgesGeometry` run in parallel with WASM?
2. Including every memory transfer, does the parallel WASM path beat the JS path in total time?
3. Does an unbounded number of WASM instances lose to startup cost, and what instance control works?

## Answers

1. Yes. Each worker owns one WASM instance, so the design needs no `SharedArrayBuffer` and no COOP/COEP headers. Every output is bit-identical to `src`, including segment order.
2. Yes, on the target workload. In the same batch, two WASM workers finish in 219 ms cold against 351 ms for the main-thread JS path (1.6x). Main-thread occupation drops from one 351 ms task to about 30 ms in short slices. A pool that is spawned and reserves memory while assets load finishes edge generation in 148 ms. Loading slows by about 40 ms, so asset loading plus edge generation takes 693 ms against 873 ms for JS and 730 ms for the pool without reserve (see "Prewarm during asset loading").
3. Yes. One worker per part (78 workers) takes 422 ms cold, which is slower than plain JS. Startup takes 322 ms of that time. A pool of two workers is optimal for this dataset because the largest part is the critical path.

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

## Recommendation

1. Adopt the WASM worker pool only for large geometries. Gate each geometry by size and keep small ones on the synchronous main-thread path. Measure the gate threshold before fixing it, as the `SCRATCH_MAX_COUNT` gate was measured.
2. Use a bounded pool. Default to 2 workers with `min(2, hardwareConcurrency - 1)`, LPT dispatch, a shared compiled module, and slice + transfer input.
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
