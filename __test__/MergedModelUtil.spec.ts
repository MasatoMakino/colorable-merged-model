import { readGeometryCount } from "../src/index.js";
import { BoxGeometry, PlaneGeometry } from "three";
import { describe, expect, test } from "vitest";

describe("MergedModelUtil", () => {
  test("count plane", () => {
    const geometry = new PlaneGeometry(1, 1, 1, 1);
    expect(readGeometryCount(geometry)).toBe(4);
  });
  test("count box", () => {
    const geometry = new BoxGeometry(1, 1, 1, 1, 1, 1);
    expect(readGeometryCount(geometry)).toBe(24);
  });
});
