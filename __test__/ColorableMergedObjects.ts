import { ColorableMergedBody, ColorableMergedEdge } from "../src";
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
      target.model.addGeometry(new BoxGeometry(1, 1, 1, 1, 1, 1), 1);
      await target.model.merge();
      expect(target.model.geometries.length).toStrictEqual(1);
      expect(target.geometry).not.toBeUndefined();
    });
  });
};
