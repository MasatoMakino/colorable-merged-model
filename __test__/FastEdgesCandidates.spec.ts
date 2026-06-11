import { type BufferGeometry, EdgesGeometry } from "three";
import { describe, expect, it } from "vitest";
import { CandidateA } from "../benchmark/candidates/CandidateA";
import { CandidateB } from "../benchmark/candidates/CandidateB";
import { CandidateC } from "../benchmark/candidates/CandidateC";
import { CandidateD } from "../benchmark/candidates/CandidateD";
import { compareEdgeSets, type EdgeSetDiff } from "../benchmark/edgeSetCompare";
import { benchGeometries, triangleCount } from "../benchmark/geometries";
import { FastEdgesGeometry } from "../src";

/**
 * Accuracy measurement: every implementation is compared against three.js
 * EdgesGeometry as ground truth, on large geometries where hash-collision
 * errors actually surface.
 *
 * - Current FastEdgesGeometry / Candidates D & A: collisions are possible by
 *   design; the diff quantifies the error rate (no hard assertion on zero).
 * - Candidates B & C: exact pair keys — zero missing/extra edges is asserted.
 */
const TIMEOUT = 300_000;

interface Implementation {
  name: string;
  exact: boolean;
  create: (geometry: BufferGeometry) => BufferGeometry;
}

const implementations: Implementation[] = [
  {
    name: "FastEdgesGeometry(current)",
    exact: false,
    create: (g) => new FastEdgesGeometry(g, 1),
  },
  { name: "CandidateD", exact: false, create: (g) => new CandidateD(g, 1) },
  { name: "CandidateA", exact: false, create: (g) => new CandidateA(g, 1) },
  { name: "CandidateB", exact: true, create: (g) => new CandidateB(g, 1) },
  { name: "CandidateC", exact: true, create: (g) => new CandidateC(g, 1) },
];

const formatDiff = (name: string, diff: EdgeSetDiff): string =>
  `${name.padEnd(28)} GT=${diff.groundTruthCount} out=${diff.candidateCount} missing=${diff.missing} extra=${diff.extra}`;

describe("FastEdges candidates: edge set accuracy vs EdgesGeometry", () => {
  for (const entry of benchGeometries) {
    it(
      entry.name,
      () => {
        const geometry = entry.create();
        const groundTruth = new EdgesGeometry(geometry, 1);
        console.info(`\n[${entry.name}] triangles=${triangleCount(geometry)}`);

        for (const impl of implementations) {
          const candidate = impl.create(geometry);
          const diff = compareEdgeSets(groundTruth, candidate, 4);
          console.info(formatDiff(impl.name, diff));
          if (diff.missing > 0 || diff.extra > 0) {
            console.info(`  missing samples: ${diff.missingSamples.join(" ")}`);
            console.info(`  extra samples:   ${diff.extraSamples.join(" ")}`);
          }

          if (impl.exact) {
            expect(diff.missing).toBe(0);
            expect(diff.extra).toBe(0);
          }
          candidate.dispose();
        }

        groundTruth.dispose();
        geometry.dispose();
      },
      TIMEOUT,
    );
  }
});
