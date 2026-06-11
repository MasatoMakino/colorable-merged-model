import type { BufferGeometry } from "three";

export interface EdgeSetDiff {
  groundTruthCount: number;
  candidateCount: number;
  /** Edges present in ground truth but missing from candidate. */
  missing: number;
  /** Edges present in candidate but absent from ground truth. */
  extra: number;
  /** Up to 5 sample keys for each direction of the diff, for diagnosis. */
  missingSamples: string[];
  extraSamples: string[];
}

/**
 * Compare the edge sets of two line-segment geometries (output of
 * EdgesGeometry-like classes) independent of segment order and endpoint order.
 *
 * Both implementations copy raw vertex coordinates into the output, so exact
 * coordinate keys would normally match; quantization guards against benign
 * float formatting differences only.
 */
export function compareEdgeSets(
  groundTruth: BufferGeometry,
  candidate: BufferGeometry,
  decimals = 4,
): EdgeSetDiff {
  const truthSet = buildEdgeMultiset(groundTruth, decimals);
  const candSet = buildEdgeMultiset(candidate, decimals);

  let missing = 0;
  let extra = 0;
  const missingSamples: string[] = [];
  const extraSamples: string[] = [];
  for (const [key, truthCount] of truthSet) {
    const candCount = candSet.get(key) ?? 0;
    if (truthCount > candCount) {
      missing += truthCount - candCount;
      if (missingSamples.length < 5) missingSamples.push(key);
    }
  }
  for (const [key, candCount] of candSet) {
    const truthCount = truthSet.get(key) ?? 0;
    if (candCount > truthCount) {
      extra += candCount - truthCount;
      if (extraSamples.length < 5) extraSamples.push(key);
    }
  }

  return {
    groundTruthCount: countEdges(truthSet),
    candidateCount: countEdges(candSet),
    missing,
    extra,
    missingSamples,
    extraSamples,
  };
}

function countEdges(multiset: Map<string, number>): number {
  let total = 0;
  for (const count of multiset.values()) total += count;
  return total;
}

function buildEdgeMultiset(
  geometry: BufferGeometry,
  decimals: number,
): Map<string, number> {
  const array = geometry.getAttribute("position").array;
  const multiset = new Map<string, number>();
  for (let i = 0; i < array.length; i += 6) {
    const a = `${array[i].toFixed(decimals)},${array[i + 1].toFixed(decimals)},${array[i + 2].toFixed(decimals)}`;
    const b = `${array[i + 3].toFixed(decimals)},${array[i + 4].toFixed(decimals)},${array[i + 5].toFixed(decimals)}`;
    // Canonical endpoint order so that segment direction does not matter
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    multiset.set(key, (multiset.get(key) ?? 0) + 1);
  }
  return multiset;
}
