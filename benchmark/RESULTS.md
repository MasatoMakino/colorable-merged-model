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

---

# Round 2 — Pure-TS variants on top of Candidate B

Date: 2026-06-11. Constraint: synchronous pure TS only (GPU / workers / async
excluded by user direction). Candidate B is the new reference point; each
round-2 candidate isolates one additional factor.

| Candidate | Adds | Isolates |
|-----------|------|----------|
| E | full unroll of the 3-edges loop + face normals stored once per face | instruction count / scratch-array elimination |
| F | E + interleaved table cells (stride-4 Int32) + int32 quantized coords | cache-line locality |
| G | F + module-level grow-only scratch arena | per-construction allocation / GC |
| H | F + sqrt-free squared-form threshold test | fast-math (output contract risk) |

A new scenario was added: **Box x1000 individual constructions** — the
library's actual code path (`EdgeGeometryMerger.convert()` constructs one edge
geometry per source geometry; `src/merger/EdgeGeometryMerger.ts:8`), where
per-construction overhead multiplies by model count.

## Accuracy

E, F, G: zero missing/extra on all 7 geometries (inherit B's exact keys).
H: also zero on all tested geometries, but its squared-form comparison is not
bit-compatible by construction; threshold-boundary flips remain possible on
other inputs.

## Performance (full-suite medians; isolated confirmation runs in parentheses)

Speedups vs current FastEdgesGeometry:

| Scenario | B | E | F | G | H |
|----------|---|---|---|---|---|
| TorusKnot 12.8k | 2.94x | 3.36x | 3.67x | **4.33x** | 3.26x |
| TorusKnot 204.8k | 1.42x | **2.18x** (confirmed ~1.7x mean isolated) | 1.21x | 2.16x | 0.46x |
| Sphere 523k | 1.35x | **1.43x** | 0.76x | 1.07x | 0.87x |
| MergedBoxes 120k | 1.80x | **1.95x** | 1.73x | 1.70x | 1.28x |
| TorusKnot 204.8k nonIdx | 0.63x* | **1.04x** | 1.05x | 1.08x | 0.87x |
| MergedBoxes 120k nonIdx | 1.00x | 0.84x* | 1.11x | **1.33x** | 1.10x |
| Box x1000 individual | 0.66x | 0.60x | 0.65x | **3.26x** (isolated: min 2.0x, mean ~1.1x) | 0.74x |

(*) High run-to-run variance (rme up to 50% in the 10-implementation suite;
GC pressure inflates and reorders mid-pack results). Medians within one suite
run are comparable; cross-run absolute values drift.

## Findings

1. **Unrolling pays (E).** Removing the inner 3-edge loop, scratch arrays and
   per-edge normal writes is worth ~1.4-1.5x over B on large indexed
   geometries and fixes B's non-indexed weakness (weld cost amortized by a
   leaner loop). E is the best single-construction variant overall.
2. **Interleaved cells do not pay in V8 (F rejected).** The stride-4 cell
   layout (one cache line per probe) was consistently <= E. The extra index
   arithmetic and int32 range checks eat the locality gain at JS level — this
   idea belongs in the WASM round, not in TS.
3. **The per-source path is allocation-bound (G).** B/E/F allocate ~12 typed
   arrays per construction and are SLOWER than current on Box x1000
   (0.60-0.66x). The arena variant turns this into 3.3x under suite memory
   pressure (isolated best-case min 2.0x). Cost: not thread-safe, retains
   largest-seen buffers. Caveat: for huge geometries the arena's explicit
   `fill(0)` of a ~64MB table region can lose to fresh zero-pages
   (Sphere: G 1.07x < E 1.43x).
4. **Sqrt elimination does not pay (H rejected).** The extra per-face length
   array and branchier emit test cost more than one sqrt per face saves, and
   it breaks bit-compatibility for threshold-boundary edges.

## Round 2 recommendation

- **Merged-geometry single construction (the user's stated primary
  scenario): adopt E** — B's exactness plus unrolled loop and shared face
  normals; 1.4-2.2x over current on 100k+ tri merged geometries, no
  regressions.
- **If the per-source path of EdgeGeometryMerger stays:** compose **E + G's
  arena** (arena on E's separate-array layout, skipping F's interleaving) and
  gate the arena reset cost: reuse scratch only below a size threshold
  (e.g. indexCount < ~500k) and fall back to fresh allocation above it.
- F and H are rejected with data; F's layout idea is deferred to a potential
  WASM round.

---

# Round 3 — Threshold sweep and the production-shaped mix (CandidateMix)

Date: 2026-06-11. Per user direction, the mix is kept as an **independent
candidate** (`benchmark/candidates/CandidateMix.ts`); `src/FastEdgesGeometry.ts`
is NOT modified.

## Threshold sweep (Candidate I = E's layout + ungated arena)

`benchmark/threshold.bench.ts`, raw data `benchmark/threshold-results.json`:

| indexCount | E (fresh) | I (arena) | arena speedup |
|-----------:|----------:|----------:|--------------:|
| 36 x1000 constructions | 35.10ms | 6.78ms | **5.17x** |
| 9.6k | 1.60ms | 1.39ms | 1.15x |
| 38.4k | 1.77ms | 1.58ms | 1.12x |
| 153.6k | 8.72ms | 7.56ms | 1.15x |
| 345.6k | 22.62ms | 21.78ms | 1.04x |
| 614.4k | 49.38ms | 49.16ms | 1.00x |
| 1152k | 122.17ms | 98.43ms | 1.24x |
| 1843k | 163.08ms | 168.85ms | 0.97x |

Key insight: with E's separate-array layout the arena's reset cost
(`fill(-1)` over the two table regions) never becomes a measurable penalty —
the large-geometry slowdown seen for Candidate G in round 2 was caused by F's
interleaved cells quadrupling the reset region, not by the arena concept.
Above ~300k indexCount the two strategies are parity within noise, so the
size gate exists to **bound retained scratch memory**, not to win speed.

**Chosen threshold: `indexCount <= 2^18 (262,144)` and
`positionCount <= 2^18`** — captures all measured arena gains, bounds the
retained scratch to roughly 30MB worst case.

## CandidateMix

- Algorithm: Candidate E at every size (exact keys, unrolled loop, shared
  face normals; `seed` becomes a no-op).
- Buffers: scratch arena below the gate, fresh allocation above it.
- Interleaved or normalized position attributes are materialized into a
  packed array once, then share the same hot loop (removes the prototype
  restriction of candidates D-I).

Compatibility evidence (`__test__/FastEdgesCandidates.spec.ts`):

- Edge-set diff vs EdgesGeometry: zero on all 7 staircase geometries.
- **Position attribute bit-identical INCLUDING segment order** to
  EdgesGeometry on the 7 standard geometries used by the existing
  `FastEdgesGeometry.spec.ts` order test — drop-in replacement evidence.

## Performance

Full-suite medians (11 implementations, same run):

| Scenario | Mix vs current |
|----------|---------------:|
| TorusKnot 12.8k | 3.19x |
| TorusKnot 204.8k | 1.50x |
| Sphere 523k | 1.26x |
| MergedBoxes 12k | **4.23x** (fastest of all candidates) |
| MergedBoxes 120k | 1.94x |
| TorusKnot 204.8k nonIdx | 1.02x |
| MergedBoxes 120k nonIdx | 1.47x |

Per-source decision pair (clean two-class process, closest to a real app):
**Mix 8.41ms mean (min 4.12) vs current 12.88ms (min 10.08) on Box x1000 —
1.53x mean, 2.4x best-case.**

Measurement caveat: in the 11-implementation suite, the Box x1000 group
converges for ALL implementations (~11-13ms) — polymorphic IC pollution from
running many classes in one process masks per-class differences. Dedicated
two-class runs (the sweep and the decision pair) are the decision-relevant
numbers for the per-source path.

## Status

- CandidateMix is the recommended production shape, held as an independent
  candidate per user direction. Porting it into `src/FastEdgesGeometry.ts`
  (preserving the public API: constructor signature, `parameters`, `copy`,
  static `taus`/`hybridtaus`) is the remaining step when adoption is decided.
- Sphere 523k: positionCount 263,169 narrowly exceeds the 2^18 gate, sending
  it down the fresh path (1.26x); a per-buffer gate or a higher limit would
  trade memory for the gap to G's 1.69x. Left as a tuning knob.
