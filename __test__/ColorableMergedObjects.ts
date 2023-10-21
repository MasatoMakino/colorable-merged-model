import {
  ColorableMergedBody,
  ColorableMergedEdge,
  TweenableColorMap,
} from "../src";
import { BoxGeometry } from "three";

export const testColorableMergedObjects = (
  target: ColorableMergedBody | ColorableMergedEdge,
  targetName: string,
) => {
  describe(`${targetName} generate test`, () => {
    test("constructor", () => {
      expect(target).toBeTruthy();
    });

    test("generate empty body or edge", async () => {
      await target.model.merge();
      expect(target.model.geometries.length).toStrictEqual(0);
    });

    test("generate", async () => {
      const colorMap = new TweenableColorMap("colors");
      await target.model.addGeometry(
        new BoxGeometry(1, 1, 1, 1, 1, 1),
        colorMap,
        1,
      );
      await target.model.merge();
      expect(target.model.geometries.length).toStrictEqual(1);
      expect(target.geometry).not.toBeUndefined();
    });
  });
};
