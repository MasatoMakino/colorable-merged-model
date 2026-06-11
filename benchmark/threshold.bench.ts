import { type BufferGeometry, TorusKnotGeometry } from "three";
import { bench, describe } from "vitest";
import { FastEdgesGeometry } from "../src";
import { CandidateE } from "./candidates/CandidateE";
import { CandidateI } from "./candidates/CandidateI";
import { CandidateMix } from "./candidates/CandidateMix";
import { createBoxArray } from "./geometries";

/**
 * Threshold sweep: fresh allocation (Candidate E) vs scratch arena
 * (Candidate I, no gate) across geometry sizes, to locate the crossover
 * indexCount for the size-gated production mix.
 *
 * Run only this sweep with:
 *   npx vitest bench --run benchmark/threshold.bench.ts
 */
const sizes: { name: string; create: () => BufferGeometry }[] = [
  // indexCount = tubularSegments * radialSegments * 6
  { name: "idx 9.6k", create: () => new TorusKnotGeometry(10, 3, 100, 16) },
  { name: "idx 38.4k", create: () => new TorusKnotGeometry(10, 3, 200, 32) },
  { name: "idx 153.6k", create: () => new TorusKnotGeometry(10, 3, 400, 64) },
  { name: "idx 345.6k", create: () => new TorusKnotGeometry(10, 3, 600, 96) },
  { name: "idx 614.4k", create: () => new TorusKnotGeometry(10, 3, 800, 128) },
  {
    name: "idx 1152k",
    create: () => new TorusKnotGeometry(10, 3, 1000, 192),
  },
  {
    name: "idx 1843k",
    create: () => new TorusKnotGeometry(10, 3, 1200, 256),
  },
];

for (const size of sizes) {
  const geometry = size.create();
  const indexCount = geometry.getIndex()?.count ?? 0;
  const options =
    indexCount > 300_000
      ? { warmupIterations: 2, warmupTime: 0, iterations: 8, time: 0 }
      : { warmupIterations: 5, warmupTime: 0, iterations: 20, time: 0 };

  describe(`threshold sweep ${size.name} (indexCount=${indexCount})`, () => {
    bench(
      "E (fresh alloc)",
      () => {
        new CandidateE(geometry, 1).dispose();
      },
      options,
    );
    bench(
      "I (arena)",
      () => {
        new CandidateI(geometry, 1).dispose();
      },
      options,
    );
  });
}

// Small-extreme end: the library's per-source path
{
  const boxes = createBoxArray(1000);
  describe("threshold sweep Box x1000 (indexCount=36 each)", () => {
    bench(
      "E (fresh alloc)",
      () => {
        for (const g of boxes) new CandidateE(g, 1).dispose();
      },
      { warmupIterations: 2, warmupTime: 0, iterations: 10, time: 0 },
    );
    bench(
      "I (arena)",
      () => {
        for (const g of boxes) new CandidateI(g, 1).dispose();
      },
      { warmupIterations: 2, warmupTime: 0, iterations: 10, time: 0 },
    );
  });
}

// Decision pair: shipping implementation vs the production-shaped mix, in a
// clean two-class context (closest to a real app that uses one class).
{
  const boxes = createBoxArray(1000);
  describe("decision pair Box x1000: current vs Mix", () => {
    bench(
      "FastEdgesGeometry(current)",
      () => {
        for (const g of boxes) new FastEdgesGeometry(g, 1).dispose();
      },
      { warmupIterations: 2, warmupTime: 0, iterations: 10, time: 0 },
    );
    bench(
      "CandidateMix",
      () => {
        for (const g of boxes) new CandidateMix(g, 1).dispose();
      },
      { warmupIterations: 2, warmupTime: 0, iterations: 10, time: 0 },
    );
  });
}
