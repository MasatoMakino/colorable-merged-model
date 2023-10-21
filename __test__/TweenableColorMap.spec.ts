import { ColorableMergedBody, TweenableColorMap } from "../src";
import * as TWEEN from "@tweenjs/tween.js";
import { BoxGeometry } from "three";
import { TweenableColorTicker } from "@masatomakino/tweenable-color";

describe("TweenableColorMap", () => {
  const generateNewColorMap = () => {
    const body = new ColorableMergedBody({ color: [1, 1, 1, 1] });
    const map = new TweenableColorMap("colors");
    map.setMergedModel(body);
    return map;
  };

  test("constructor", () => {
    const map = generateNewColorMap();
    expect(map).not.toBeUndefined();
  });

  test("add default", () => {
    const id = 3;
    const map = generateNewColorMap();
    map.addColor([0, 0, 0, 0], id);
    expect(map.get(id)).not.toBeUndefined();
    expect(map.get(id)?.getAttribute()).toStrictEqual([0, 0, 0, 0]);
  });

  test("change color", async () => {
    const id = 1;
    const body = new ColorableMergedBody({ color: [0, 0, 0, 0] });
    const map = new TweenableColorMap("colors");
    map.setMergedModel(body);

    map.addColor([0, 0, 0, 0], id);
    await body.model.addGeometry(new BoxGeometry(1, 1, 1, 1, 1, 1), id);
    await body.model.merge();

    expect(map).not.toBeUndefined();
    expect(map.get(id)?.getAttribute()).toStrictEqual([0, 0, 0, 0]);

    map.changeColor([1, 1, 1, 1], id, {
      duration: 1,
      now: 0,
      easing: TWEEN.Easing.Linear.None,
    });
    TweenableColorTicker.update(0);
    map.forceUpdateColorAttribute();
    expect(map.get(id)?.getAttribute()).toStrictEqual([0, 0, 0, 0]);

    TweenableColorTicker.update(0.5);
    map.forceUpdateColorAttribute();
    expect(map.get(id)?.getAttribute()).toStrictEqual([0.5, 0.5, 0.5, 0.5]);

    TweenableColorTicker.update(1);
    map.forceUpdateColorAttribute();
    expect(map.get(id)?.getAttribute()).toStrictEqual([1, 1, 1, 1]);
  });
});
