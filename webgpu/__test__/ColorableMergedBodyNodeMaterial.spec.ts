import { describe, expect, it } from "vitest";
import { ColorableMergedBodyNodeMaterial, TweenableColorMap } from "../src";

describe("ColorableMergedBodyNodeMaterial", () => {
  it("constructor", () => {
    const colorMap = new TweenableColorMap("colors");
    colorMap.add([0, 0, 0, 0], 1);
    const materlal = new ColorableMergedBodyNodeMaterial(colorMap);
    expect(materlal).toBeInstanceOf(ColorableMergedBodyNodeMaterial);
  });

  it("should throw error when generating empty color map", () => {
    const colorMap = new TweenableColorMap("colors");
    expect(() => new ColorableMergedBodyNodeMaterial(colorMap)).toThrow();
  });
});
