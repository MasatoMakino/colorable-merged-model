import {
  ColorableMergedBody,
  ColorableMergedEdge,
  TweenableColorMap,
} from "../src";
import { BoxGeometry } from "three";
import { describe, expect, test } from "vitest";

export const testColorableMergedObjects = (
  target: ColorableMergedBody | ColorableMergedEdge,
  targetName: string,
) => {
  describe(`${targetName} generate test`, () => {
    test("constructor", () => {
      expect(target).toBeTruthy();
    });

    test("generate empty body or edge", async () => {
      await target.geometryMerger.merge();
      expect(target.geometryMerger.geometries.length).toStrictEqual(0);
    });

    test("generate", async () => {
      const colorMap = new TweenableColorMap("colors");
      await target.geometryMerger.add(
        new BoxGeometry(1, 1, 1, 1, 1, 1),
        colorMap,
        1,
      );
      await target.geometryMerger.merge();
      expect(target.geometryMerger.geometries.length).toStrictEqual(1);
      expect(target.geometry).not.toBeUndefined();
    });
  });
};
