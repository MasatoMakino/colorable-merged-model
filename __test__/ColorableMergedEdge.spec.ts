import { describe, expect, it } from "vitest";
import { ColorableMergedEdge } from "../src";
import { testColorableMergedObjects } from "./ColorableMergedObjects";

describe("ColorableMergedEdge", () => {
  const edgeDefault = new ColorableMergedEdge({ color: [1, 1, 1, 1] });
  testColorableMergedObjects(edgeDefault, "ColorableMergedEdge (default)");

  const edgeFast = new ColorableMergedEdge({
    color: [1, 1, 1, 1],
    useFastEdgesGeometry: true,
  });
  testColorableMergedObjects(
    edgeFast,
    "ColorableMergedEdge (FastEdgesGeometry)",
  );

  it("throws at construction for an invalid tableCapacityFactor so the error appears before the first merge", () => {
    expect(
      () =>
        new ColorableMergedEdge({
          color: [1, 1, 1, 1],
          useFastEdgesGeometry: true,
          tableCapacityFactor: 1 as never,
        }),
    ).toThrow(RangeError);
  });
});
