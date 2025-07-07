import { describe, expect, it } from "vitest";
import { ColorableMergedMaterial } from "../src";

describe("ColorableMergedMaterial", () => {
  it("constructor", () => {
    const materlal = new ColorableMergedMaterial({}, 1);
    expect(materlal).toBeInstanceOf(ColorableMergedMaterial);
  });

  it.fails("generate empty body or edge", async () => {
    const _materlal = new ColorableMergedMaterial({}, 0);
  });
});
