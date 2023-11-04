import { ColorableMergedEdge } from "../src";
import { testColorableMergedObjects } from "./ColorableMergedObjects";
import { describe } from "vitest";

describe("ColorableMergedEdge", () => {
  const edge = new ColorableMergedEdge({ color: [1, 1, 1, 1] });
  testColorableMergedObjects(edge, "ColorableMergedEdge");
});
