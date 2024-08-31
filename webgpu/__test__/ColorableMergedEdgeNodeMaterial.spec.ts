import { describe, it, expect } from "vitest";
import { ColorableMergedEdgeNodeMaterial, TweenableColorMap } from "../src";

describe("ColorableMergedEdgeNodeMaterial", () => {
  it("constructor", () => {
    const colorMap = new TweenableColorMap("colors");
    colorMap.add([0, 0, 0, 0], 1);
    const materlal = new ColorableMergedEdgeNodeMaterial(colorMap);
    expect(materlal).toBeInstanceOf(ColorableMergedEdgeNodeMaterial);
  });

  it.fails("generate empty color map", async () => {
    const colorMap = new TweenableColorMap("colors");
    const materlal = new ColorableMergedEdgeNodeMaterial(colorMap);
  });
});
