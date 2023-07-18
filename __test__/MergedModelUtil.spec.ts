import { readGeometryCount } from "../src/index.js";
import { BoxGeometry, BufferGeometry, PlaneGeometry } from "three";

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
