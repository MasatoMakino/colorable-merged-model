import { ColorableMergedBody } from "../src";
import { BoxGeometry } from "three";

describe("ColorableMergedBody", () => {
  test("constructor", () => {
    const body = new ColorableMergedBody({ color: [1, 1, 1, 1] });
    expect(body).toBeTruthy();
  });

  test("skip generate", async () => {
    const body = new ColorableMergedBody({ color: [1, 1, 1, 1] });
    await body.generate();
    expect(body.colorMap.colors.size).toStrictEqual(0);
  });

  test("generate", async () => {
    const body = new ColorableMergedBody({ color: [1, 1, 1, 1] });
    body.addModel(new BoxGeometry(1, 1, 1, 1, 1, 1), 1);
    await body.generate();
    expect(body.colorMap.colors.size).toStrictEqual(1);
  });
});
