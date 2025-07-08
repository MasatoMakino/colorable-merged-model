import { describe, expect, it } from "vitest";
import { ColorableMergedEdgeNodeMaterial, TweenableColorMap } from "../src";

describe("ColorableMergedEdgeNodeMaterial", () => {
  it("constructor", () => {
    const colorMap = new TweenableColorMap("colors");
    colorMap.add([0, 0, 0, 0], 1);
    const materlal = new ColorableMergedEdgeNodeMaterial(colorMap);
    expect(materlal).toBeInstanceOf(ColorableMergedEdgeNodeMaterial);
  });

  it("should throw error when generating empty color map", () => {
    const colorMap = new TweenableColorMap("colors");
    expect(() => new ColorableMergedEdgeNodeMaterial(colorMap)).toThrow();
  });
});
