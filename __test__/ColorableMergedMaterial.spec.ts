import { describe, it, test, expect } from "vitest";
import { ColorableMergedMaterial, TweenableColorMap } from "../src";

describe("ColorableMergedMaterial", () => {
  it("constructor", () => {
    const materlal = new ColorableMergedMaterial({}, 1);
    expect(materlal).toBeInstanceOf(ColorableMergedMaterial);
  });

  it.fails("generate empty body or edge", async () => {
    const materlal = new ColorableMergedMaterial({}, 0);
  });
});
