import { describe, expect, it } from "vitest";
import { ColorableMergedBodyNodeMaterial, TweenableColorMap } from "../src";

describe("ColorableMergedBodyNodeMaterial", () => {
  it("constructor", () => {
    const colorMap = new TweenableColorMap("colors");
    colorMap.add([0, 0, 0, 0], 1);
    const materlal = new ColorableMergedBodyNodeMaterial(colorMap);
    expect(materlal).toBeInstanceOf(ColorableMergedBodyNodeMaterial);
  });

  it.fails("generate empty color map", async () => {
    const colorMap = new TweenableColorMap("colors");
    const _materlal = new ColorableMergedBodyNodeMaterial(colorMap);
  });
});
