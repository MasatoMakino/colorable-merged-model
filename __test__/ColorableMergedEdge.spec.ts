import { describe, it } from "vitest";
import { ColorableMergedEdge } from "../src";
import { testColorableMergedObjects } from "./ColorableMergedObjects";

describe("ColorableMergedEdge", () => {
  it("should correctly initialize ColorableMergedEdge with default parameters", () => {
    const edge = new ColorableMergedEdge({ color: [1, 1, 1, 1] });
    testColorableMergedObjects(edge, "ColorableMergedEdge");
  });

  it("should use FastEdgesGeometry when useFastEdgesGeometry is true", () => {
    const edge = new ColorableMergedEdge({
      color: [1, 1, 1, 1],
      useFastEdgesGeometry: true,
    });
    testColorableMergedObjects(edge, "ColorableMergedEdge");
  });
});
