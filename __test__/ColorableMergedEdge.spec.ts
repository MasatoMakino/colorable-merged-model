import { describe } from "vitest";
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
});
