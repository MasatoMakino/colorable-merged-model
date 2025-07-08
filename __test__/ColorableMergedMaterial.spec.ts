import { describe, expect, it } from "vitest";
import { ColorableMergedMaterial } from "../src";

describe("ColorableMergedMaterial", () => {
  it("constructor", () => {
    const materlal = new ColorableMergedMaterial({}, 1);
    expect(materlal).toBeInstanceOf(ColorableMergedMaterial);
  });

  it("should throw error when generating empty body or edge", () => {
    expect(() => new ColorableMergedMaterial({}, 0)).toThrow();
  });
});
