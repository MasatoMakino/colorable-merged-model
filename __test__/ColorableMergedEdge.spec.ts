import { ColorableMergedEdge } from "../src";
import { testColorableMergedObjects } from "./ColorableMergedObjects";

describe("ColorableMergedEdge", () => {
  const edge = new ColorableMergedEdge({ color: [1, 1, 1, 1] });
  testColorableMergedObjects(edge, "ColorableMergedEdge");
});
