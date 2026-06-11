import { type BufferGeometry, EdgesGeometry } from "three";
import { bench, describe } from "vitest";
import { FastEdgesGeometry } from "../src";
import { CandidateA } from "./candidates/CandidateA";
import { CandidateB } from "./candidates/CandidateB";
import { CandidateC } from "./candidates/CandidateC";
import { CandidateD } from "./candidates/CandidateD";
import { CandidateE } from "./candidates/CandidateE";
import { CandidateF } from "./candidates/CandidateF";
import { CandidateG } from "./candidates/CandidateG";
import { CandidateH } from "./candidates/CandidateH";
import { benchGeometries, createBoxArray, triangleCount } from "./geometries";

/**
 * Initialization-time benchmark across the geometry staircase.
 *
 * Run with: npx vitest bench --run
 *
 * Geometries are created once per suite; each bench measures construction of
 * the edge geometry only (the user-facing initialization cost).
 */
interface Implementation {
  name: string;
  create: (geometry: BufferGeometry) => BufferGeometry;
}

const implementations: Implementation[] = [
  { name: "EdgesGeometry(three.js)", create: (g) => new EdgesGeometry(g, 1) },
  {
    name: "FastEdgesGeometry(current)",
    create: (g) => new FastEdgesGeometry(g, 1),
  },
  { name: "CandidateD", create: (g) => new CandidateD(g, 1) },
  { name: "CandidateA", create: (g) => new CandidateA(g, 1) },
  { name: "CandidateB", create: (g) => new CandidateB(g, 1) },
  { name: "CandidateC", create: (g) => new CandidateC(g, 1) },
  { name: "CandidateE", create: (g) => new CandidateE(g, 1) },
  { name: "CandidateF", create: (g) => new CandidateF(g, 1) },
  { name: "CandidateG", create: (g) => new CandidateG(g, 1) },
  { name: "CandidateH", create: (g) => new CandidateH(g, 1) },
];

for (const entry of benchGeometries) {
  const geometry = entry.create();
  const triangles = triangleCount(geometry);
  // Fewer iterations on huge geometries to keep total runtime manageable
  const options =
    triangles > 100_000
      ? { warmupIterations: 2, warmupTime: 0, iterations: 8, time: 0 }
      : { warmupIterations: 5, warmupTime: 0, iterations: 25, time: 0 };

  describe(`${entry.name} (${triangles} tri)`, () => {
    for (const impl of implementations) {
      bench(
        impl.name,
        () => {
          impl.create(geometry).dispose();
        },
        options,
      );
    }
  });
}

// Per-source code path (EdgeGeometryMerger.convert constructs one edge
// geometry per source geometry before merging): measures per-construction
// overhead such as allocation/GC, which single large constructions hide.
{
  const boxes = createBoxArray(1000);
  describe("Box x1000 individual constructions (12 tri each)", () => {
    for (const impl of implementations) {
      bench(
        impl.name,
        () => {
          for (const g of boxes) {
            impl.create(g).dispose();
          }
        },
        { warmupIterations: 2, warmupTime: 0, iterations: 10, time: 0 },
      );
    }
  });
}
