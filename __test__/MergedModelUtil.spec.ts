import { readGeometryCount } from "../src/index.js";
import { BoxGeometry, BufferGeometry } from "three";

describe("MergedModelUtil", () => {
  test("count position", () => {
    const geometry = new BoxGeometry(1, 1, 1, 1, 1, 1);
    expect(readGeometryCount(geometry)).toBe(24);
  });
});
