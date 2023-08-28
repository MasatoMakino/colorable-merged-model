import { ColorableMergedView } from "../src";
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
    view.addGeometry(new BoxGeometry(1, 1, 1, 1, 1, 1), 1);
    await view.merge();
    expect(view.body?.model.colorMap.colors.size).toStrictEqual(1);
    expect(view.edge?.model.colorMap.colors.size).toStrictEqual(1);
  });

  test("add geometry with type", async () => {
    const view = generateView();
    view.addGeometry(new BoxGeometry(1, 1, 1, 1, 1, 1), 1, "test");
    await view.merge();
    expect(view.body?.model.colorMap.colors.size).toStrictEqual(1);
    expect(view.edge?.model.colorMap.colors.size).toStrictEqual(1);
    expect(view.body?.model.colorMap.get(1, "test")).toBeTruthy();
    expect(view.edge?.model.colorMap.get(1, "test")).toBeTruthy();
  });

  test("add geometry with no options", async () => {
    const view = new ColorableMergedView({});
    view.addGeometry(new BoxGeometry(1, 1, 1, 1, 1, 1), 1);
    await view.merge();
    expect(view.body).toBeUndefined();
    expect(view.edge).toBeUndefined();
  });

  test("change color", async () => {
    const view = generateView();
    await view.addGeometry(new BoxGeometry(1, 1, 1, 1, 1, 1), 1);
    await view.merge();
    view.changeColor({
      bodyColor: [0, 1, 1, 1],
      edgeColor: [1, 0, 1, 1],
      id: 1,
      duration: 1,
      easing: Easing.Linear.None,
      now: 0,
    });

    const update = (
      now: number,
      bodyColor: [number, number, number, number],
      edgeColor: [number, number, number, number],
    ) => {
      TweenableColorTicker.update(now);
      view.body?.model.colorMap.forceUpdateColorAttribute();
      view.edge?.model.colorMap.forceUpdateColorAttribute();
      expect(view.body?.model.colorMap.get(1)?.getAttribute()).toStrictEqual(
        bodyColor,
      );
      expect(view.edge?.model.colorMap.get(1)?.getAttribute()).toStrictEqual(
        edgeColor,
      );
    };
    update(0, [1, 1, 1, 1], [1, 1, 1, 1]);
    update(0.5, [0.5, 1, 1, 1], [1, 0.5, 1, 1]);
    update(1, [0, 1, 1, 1], [1, 0, 1, 1]);
  });
});
