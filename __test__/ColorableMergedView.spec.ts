import { ColorableMergedView, TweenableColorMap } from "../src";
import { BoxGeometry } from "three";
import { TweenableColorTicker } from "@masatomakino/tweenable-color";
import { Easing } from "@tweenjs/tween.js";

describe("ColorableMergedView", () => {
  const generateView = () => {
    return new ColorableMergedView({
      bodyOption: { color: [1, 1, 1, 1] },
      edgeOption: { color: [1, 1, 1, 1] },
    });
  };

  test("constructor", () => {
    const view = generateView();
    expect(view).toBeTruthy();
  });

  test("view with no geometry added, body and edge should be undefined.", async () => {
    const view = new ColorableMergedView({});
    expect(view).toBeTruthy();
    expect(view.body).toBeUndefined();
    expect(view.edge).toBeUndefined();
  });

  test("geometry id", () => {
    const view = generateView();
    const id = view.getGeometryID("test_1_2");
    expect(id).toStrictEqual(2);
  });

  test("geometry id invalid", () => {
    const view = generateView();
    expect(() => view.getGeometryID("test_1")).toThrowError();
  });

  test("switch geometry id generator", () => {
    const view = generateView();
    view.getGeometryID = (name: string): number => {
      const match = name.match(/.*_(\d*)/);
      return Number(match?.[1]);
    };
    expect(view.getGeometryID("test_1")).toStrictEqual(1);
  });

  test("add geometry", async () => {
    const view = generateView();
    const bodyMap = new TweenableColorMap("colors");
    const edgeMap = new TweenableColorMap("colors");
    await view.body?.model.addGeometry(
      new BoxGeometry(1, 1, 1, 1, 1, 1),
      bodyMap,
      1,
    );
    await view.edge?.model.addGeometry(
      new BoxGeometry(1, 1, 1, 1, 1, 1),
      edgeMap,
      1,
    );

    await view.merge();
    expect(view.body?.model.object3D).not.toBeUndefined();
    expect(view.edge?.model.object3D).not.toBeUndefined();
  });

  test("add geometry with no options", async () => {
    const view = new ColorableMergedView({});
    const bodyMap = new TweenableColorMap("colors");
    const edgeMap = new TweenableColorMap("colors");
    await view.body?.model.addGeometry(
      new BoxGeometry(1, 1, 1, 1, 1, 1),
      bodyMap,
      1,
    );
    await view.edge?.model.addGeometry(
      new BoxGeometry(1, 1, 1, 1, 1, 1),
      edgeMap,
      1,
    );

    await view.merge();
    expect(view.body).toBeUndefined();
    expect(view.edge).toBeUndefined();
  });
});
