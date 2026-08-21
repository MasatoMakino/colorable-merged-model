import { BoxGeometry, Group } from "three";
import { describe, expect, test } from "vitest";
import {
  type ColorableMergedBody,
  type ColorableMergedEdge,
  TweenableColorMap,
} from "../src";

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

    // The tests below share the target merged by "generate" and run in order:
    // the release happens once, and the following two observe that state.
    test("clearSourceGeometries() drops the pre-merge geometries but keeps the merged result usable", () => {
      target.geometryMerger.clearSourceGeometries();
      expect(target.geometryMerger.geometries.length).toStrictEqual(0);
      expect(target.geometry).not.toBeUndefined();
    });

    test("add() after clearSourceGeometries() rejects, because the released merger can no longer produce a complete merge result", async () => {
      const colorMap = new TweenableColorMap("colors");
      await expect(
        target.geometryMerger.add(
          new BoxGeometry(1, 1, 1, 1, 1, 1),
          colorMap,
          2,
        ),
      ).rejects.toThrow();
    });

    test("merge() after clearSourceGeometries() rejects instead of silently removing the object from its parent", async () => {
      const parent = new Group();
      parent.add(target);

      await expect(target.geometryMerger.merge()).rejects.toThrow();
      expect(target.parent).toBe(parent);
    });
  });
};
