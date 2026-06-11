---
name: fastedgesgeometry-architecture
description: Architecture and implementation details of FastEdgesGeometry. Use when modifying FastEdgesGeometry, understanding its optimization techniques, or debugging edge generation issues.
---

# FastEdgesGeometry Architecture

## Background

FastEdgesGeometry is a performance-optimized fork of Three.js EdgesGeometry. The original EdgesGeometry had performance issues with complex geometries, leading to the creation of this optimized version.

File: `src/FastEdgesGeometry.ts`

## Evolution History

### Stage 1: Three.js EdgesGeometry (Original)

Standard Three.js EdgesGeometry implementation:

| Aspect | Implementation |
|--------|----------------|
| Edge identity | String concatenation: `"x,y,z"` format (4 decimal precision) — exact, collision-free |
| Edge storage | `Object` with string keys: `"hash0_hash1"` |
| Normal calculation | `Triangle.getNormal()` method |
| Vertex accumulation | `Array.push()` |

**Problem**: String key generation and object key lookup are slow

### Stage 2: FastEdgesGeometry (v0.7.3, 2024-11)

Replaced string keys with 32-bit numeric hashes:

| Aspect | Implementation |
|--------|----------------|
| Edge identity | Numeric hash via `hybridtaus()` (Tausworthe algorithm) — lossy, collision-prone |
| Edge storage | `Map<number, {index0, index1, normal}>` |
| Normal calculation | `Triangle.getNormal()` method (unchanged) |
| Vertex accumulation | `Array.push()` (unchanged) |

**Improvement**: Numeric hash speeds up edge lookup (~3-4x faster)
**Trade-off introduced**: Hash collisions could corrupt edge detection; `seed` / `precisionPoints` options served as workarounds

### Stage 3: FastEdgesGeometry (v0.7.4+, 2026-01)

Applied micro-optimizations:

| Aspect | Implementation |
|--------|----------------|
| Edge identity | Inline `computeHash()` with pre-transformed seed (still collision-prone) |
| Edge storage | `Map<number, slot>` + parallel Typed Arrays |
| Normal calculation | Direct cross product calculation |
| Vertex accumulation | Pre-allocated `Float32Array` with index tracking |

**Improvement**: Function inlining, Typed Arrays, object allocation avoidance (~30% faster)

### Stage 4: FastEdgesGeometry (2026-06, PR #371)

Full rewrite with exact edge identity — eliminates the Stage 2 accuracy trade-off while getting faster:

| Aspect | Implementation |
|--------|----------------|
| Edge identity | **Exact integer pair of welded vertex ids.** A weld pre-pass maps each vertex to a canonical id by exact comparison of quantized coordinates. Hashes only pick probe start positions in open-addressing tables — they never decide identity |
| Edge storage | Open-addressing typed-array tables (linear probing, load factor <= 0.5, `-1` empty / `-2` tombstone) + parallel slot arrays in insertion order |
| Normal calculation | Direct cross product, stored once per face (`Float64Array`); the stored side is rounded with `Math.fround` at comparison time |
| Hot loop | 3-edges-per-triangle loop fully unrolled with scalar locals |
| Buffers | Module-level grow-only scratch arena when `indexCount` and `positionCount` <= 2^18; fresh allocation above (gate bounds retained memory ~30MB, speed is parity above the gate) |
| Attribute access | Direct `.array` reads; interleaved/normalized attributes are materialized into a packed copy once |

**Improvement**: collision-free output (the `seed` option became a documented no-op), 1.26x-4.2x vs Stage 3 depending on scenario, bit-identical to EdgesGeometry including segment order on standard geometries.

## Output Contract Invariants (Stage 4)

Violating any of these breaks bit-compatibility with EdgesGeometry / previous outputs:

1. **Dot-product precision convention**: threshold test compares `float64 (current face normal) x fround(stored normal)`. Comparing float32 x float32 (or float64 x float64) flips threshold-boundary edges (~1 in 170k edges on a 1-degree-threshold mesh).
2. **Pairing semantics**: a directed edge `(a->b)` pairs with the latest unmatched `(b->a)`. A duplicate directed edge (non-manifold) overwrites the earlier one, which is never emitted.
3. **Emission order**: matched edges are emitted at the stream position of the second (current) face; unmatched edges are emitted afterwards in insertion order.
4. **Weld pass is O(positionCount)**: every vertex is welded once, including unreferenced ones (pathological geometries with positionCount >> indexCount pay extra).
5. **Thread safety**: the shared scratch arena makes the class not thread-safe (same caveat as the Stage 3 static arrays).

## Legacy Public API

`static taus()` / `static hybridtaus()` are retained for backward compatibility but are no longer used for edge identity. The Tausworthe-style bit-mixing (magic masks `0xfffffffe` / `0xfffffff8` / `0xfffffff0`, GPU Gems 3 Ch. 37) survives inline in the weld pass purely as a probe-start scrambler.

## Performance Results

Stage 4 measurements (vitest bench, DevContainer Node 24; medians; details in PR #371):

| Scenario | vs Stage 3 | vs three.js EdgesGeometry |
|----------|-----------:|--------------------------:|
| Box x1000 individual constructions (EdgeGeometryMerger per-source path) | 1.53x mean / 2.4x best | ~4.6x |
| MergedBoxes 12k / 120k tri | 4.23x / 1.94x | ~15-27x |
| TorusKnot 204.8k tri / Sphere 523k tri | 1.50x / 1.26x | ~16-20x |
| TorusKnot 204.8k tri non-indexed | 1.02x (parity) | ~14x |

Accuracy: Stage 3 emitted 1 spurious edge on a smooth 523k-triangle sphere (hash collision, matching the birthday estimate for 32-bit hashes at ~1.57M directed edges); Stage 4 emits 0.

## Measurement Archive

The benchmark harness, candidates A-I/Mix, accuracy specs, threshold sweep, and the full RESULTS.md exist only in the history of PR #371 (merge commit `be262e8`):

- `021f9d3` — round 1: harness, candidates A-D, first quantification of the collision error
- `d418f62` — round 2: candidates E-H (rejected with data: interleaved table cells, sqrt-free threshold test)
- `c7cb9e1` — round 3: threshold sweep, production-shaped CandidateMix
- `8f1669d` — removal of the scaffolding from the tree

Measurement caveat learned: microbenchmarks running many implementation classes in one process converge due to polymorphic IC pollution — use dedicated two-class runs for adoption decisions.

## Optimization Principles Applied

1. **Never let hashes decide identity** - Hash only picks the probe start; identity is exact comparison (collision-free at hash-level speed)
2. **Inline and unroll hot loops** - Eliminate call stack overhead and scratch-array indexing
3. **Pre-allocate fixed arrays** - Replace dynamic structures (`Map`, `push()`) with typed-array tables and index tracking
4. **Reuse buffers below a size gate** - Allocation dominates small repeated constructions; explicit resets dominate huge ones

## Trade-offs

- **Readability**: Code is long and repetitive (unrolled edge blocks); changes must be applied to all three blocks consistently
- **Maintainability**: Changes require understanding the Output Contract Invariants above
- **Memory**: The scratch arena retains the largest-seen buffers (bounded ~30MB by the 2^18 gate)
- **Justification**: Edge geometry generation directly impacts user experience (frame drops during scene initialization)

## Future Optimization Considerations

If further optimization is needed (1M+ triangles or sub-50ms requirements):
- WASM SIMD port of the sort-based pairing layout (Candidate C in the PR #371 history — sequential typed-array passes, designed for portability)
- WebGPU Compute Shader; pays off only if the `webgpu/` render path can consume results without readback
- Web Workers were evaluated and rejected (startup + copy overhead offsets gains); a SharedArrayBuffer pool would impose COOP/COEP on library users
