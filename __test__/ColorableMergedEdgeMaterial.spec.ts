import { ColorableMergedEdgeMaterial, TweenableColorMap } from "../src";
import { it, describe, expect } from "vitest";

describe("ColorableMergedEdgeMaterial", () => {
  it("constructor", () => {
    const colorMap = new TweenableColorMap("colors");
    colorMap.add([0, 0, 0, 0], 1);
    const materlal = new ColorableMergedEdgeMaterial(colorMap);
    expect(materlal).toBeInstanceOf(ColorableMergedEdgeMaterial);
  });
});
