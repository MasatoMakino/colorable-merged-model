# FastEdgesGeometry Optimization Round 1 — Measurement Results

Date: 2026-06-11
Environment: DevContainer (node:24-bookworm-slim, Docker on macOS host), vitest bench (tinybench), jsdom environment.
Raw data: `benchmark/results.json` (vitest bench `--outputJson`).

## Scope

Pure-TypeScript candidates only (synchronous API, no toolchain changes).
WASM / WebGPU / worker-pool candidates are deferred to a possible round 2 (see Recommendation).

| Candidate | Strategy |
|-----------|----------|
| D | Current algorithm, BufferAttribute abstraction removed from the hot loop (direct typed-array reads) |
| A | D + edge `Map<number, number>` replaced with an open-addressing (linear probing) typed-array hash table |
| B | Vertex-weld pre-pass + exact integer pair keys (collision-free by construction) + A's table |
| C | B's weld + sort-based pairing (stable LSD radix sort, no hash table) — designed as a WASM/GPU-portable layout |

All candidates live under `benchmark/candidates/` and do not modify `src/`.

## Accuracy (vs three.js EdgesGeometry as ground truth)

Edge multiset comparison with canonical endpoint ordering, 4-decimal quantization
(`__test__/FastEdgesCandidates.spec.ts`).

| Geometry | current | D | A | B | C |
|----------|---------|---|---|---|---|
| TorusKnot 12.8k tri | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| TorusKnot 204.8k tri | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| Sphere 523k tri | **0 / 1** | **0 / 1** | **0 / 1** | 0 / 0 | 0 / 0 |
| MergedBoxes 12k tri | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| MergedBoxes 120k tri | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| TorusKnot 204.8k nonIndexed | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| MergedBoxes 120k nonIndexed | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |

(cells = missing / extra edges)

Findings:

- **The current implementation's hash-collision error was quantified for the
  first time**: on Sphere(1,512,512) (~523k triangles, ~1.57M directed edges)
  it emits 1 spurious edge on a surface that should produce none at
  thresholdAngle=1°. The probability matches the birthday estimate for 32-bit
  edge hashes (~29% per geometry at 1.57M edges). Candidates D and A inherit
  the same hash design and reproduce the identical spurious edge.
- **Candidates B and C are exact on every geometry tested.** Exact pair keys
  remove the failure mode entirely; the `seed` / `precisionPoints` collision
  workarounds become unnecessary.
- During development, Candidate C initially diverged by 1 edge in 169k on the
  204.8k TorusKnot. Diagnosis showed both divergent edges are plain 2-manifold
  edges lying exactly on the 1° threshold: the current implementation compares
  `float64 (current face normal) · float32 (stored normal)`, and comparing
  `float32 · float32` flips the decision for threshold-boundary edges.
  Reproducing the mixed-precision dot product (`Math.fround` on the stored
  side) made C bit-compatible. Lesson: the dot-product precision convention is
  part of the output contract for threshold-boundary edges.

## Performance (initialization time, median)

vitest bench; large geometries 8 iterations / 2 warmup, others 25 / 5.
Speedup factors are relative to the current FastEdgesGeometry.

| Geometry | three.js | current | D | A | B | C |
|----------|---------:|--------:|--:|--:|--:|--:|
| TorusKnot 12.8k | 46.4ms | 4.68ms | 4.21ms (1.11x) | 2.19ms (2.14x) | **1.66ms (2.82x)** | 4.91ms (0.95x) |
| TorusKnot 204.8k | 1087ms | 85.0ms | 91.8ms (0.93x) | **74.1ms (1.15x)** | 75.4ms (1.13x) | 96.3ms (0.88x) |
| Sphere 523k | 2861ms | 239ms | 229ms (1.05x) | 156ms (1.53x) | **153ms (1.57x)** | 211ms (1.14x) |
| MergedBoxes 12k | 42.8ms | 4.67ms | 4.40ms (1.06x) | **1.97ms (2.37x)** | 2.75ms (1.70x) | 5.17ms (0.90x) |
| MergedBoxes 120k | 597ms | 45.6ms | 44.1ms (1.03x) | **31.0ms (1.47x)** | 35.6ms (1.28x) | 54.8ms (0.83x) |
| TorusKnot 204.8k nonIdx | 1041ms | 84.3ms | 75.7ms (1.11x) | **69.7ms (1.21x)** | 84.3ms (1.00x) | 148ms (0.57x) |
| MergedBoxes 120k nonIdx | 509ms | 45.0ms | 42.1ms (1.07x) | **34.7ms (1.30x)** | 36.2ms (1.25x) | 57.0ms (0.79x) |

Against three.js EdgesGeometry, A/B reach **14x–28x** (current: 10x–13x).

## Time breakdown (ablation + profiling)

`node --cpu-prof` attributes 76% of self time to the constructor itself:
V8 inlines `Map` intrinsics and the hash closure into the optimized function,
so function-level profiling cannot decompose the loop. The candidate ablation
is the effective breakdown:

| Component (isolated by) | Share of current init time |
|--------------------------|---------------------------|
| `Map` get/set/delete (A vs D) | ~25–45% (geometry-dependent) |
| BufferAttribute abstraction (D vs current) | ~5–10% |
| `fromBufferAttribute` visible in profile | 3.2% |
| GC | ~4% (plus run-to-run spikes; A/B reduce min-times up to 2.8x) |

## Analysis

- **Candidate A is the only strictly-dominant change**: 1.15x–2.4x across
  every geometry and never slower. The open-addressing table is the main
  lever, confirming the Map-overhead hypothesis.
- **Candidate B adds exactness on top of A-level speed.** It is the fastest
  on indexed geometries (hash work drops to once per vertex instead of ~6x per
  shared vertex). On non-indexed geometries the weld pre-pass must hash every
  corner, so B falls back to roughly current-level speed on smooth non-indexed
  meshes (TorusKnot nonIndexed: 1.00x) while still 1.25x on merged boxes.
- **Candidate C does not pay off in JavaScript.** The radix-sort constant cost
  exceeds the table lookups it replaces at every size tested (0.57x–1.14x).
  Its value is as a blueprint: every pass is a sequential typed-array scan,
  directly portable to WASM SIMD or WebGPU compute. A JS adoption is not
  recommended.
- The library's real use case (merged boxes — many small geometries, high edge
  density) benefits 1.3x–2.4x from A/B.

## Recommendation

1. **Adopt Candidate B's design as the next FastEdgesGeometry** (indexed and
   non-indexed): equal-or-better speed everywhere except one tie, 1.3x–2.8x on
   the library's primary workloads, and the accuracy trade-off introduced by
   the numeric-hash fork is eliminated (no more `seed` / `precisionPoints`
   workarounds). If the rare non-indexed tie matters, dispatch to A's keying
   for non-indexed inputs as a micro-optimization.
2. **Round 2 (WASM/WebGPU) is optional, not urgent.** After B, a 523k-triangle
   geometry initializes in ~150ms. If target scenes exceed ~1M triangles or
   need sub-50ms initialization, prototype WASM (Candidate C's layout) first;
   WebGPU compute pays off only if the `webgpu/` path can keep results on-GPU
   and skip readback.
3. Threshold-boundary edges depend on the mixed-precision dot product
   convention; any reimplementation must preserve `float64 · fround(float32)`
   to remain bit-compatible with the current output.
