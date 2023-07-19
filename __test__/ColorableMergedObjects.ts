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
      await target.generate();
      expect(target.colorMap.colors.size).toStrictEqual(0);
    });

    test("generate", async () => {
      target.addModel(new BoxGeometry(1, 1, 1, 1, 1, 1), 1);
      await target.generate();
      expect(target.colorMap.colors.size).toStrictEqual(1);
    });
  });
};
