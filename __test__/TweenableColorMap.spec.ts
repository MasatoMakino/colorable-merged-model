import {
  ColorableMergedBody,
  ColorableMergedBodyMaterial,
  TweenableColorMap,
} from "../src";
import * as TWEEN from "@tweenjs/tween.js";
import { BoxGeometry, ShaderMaterial } from "three";
import { TweenableColorTicker } from "@masatomakino/tweenable-color";
import { describe, expect, test } from "vitest";

describe("TweenableColorMap", () => {
  const generateNewColorMap = () => {
    return new TweenableColorMap("colors");
  };

  test("constructor", () => {
    const map = generateNewColorMap();
    expect(map).not.toBeUndefined();
  });

  test("add default", () => {
    const id = 3;
    const map = generateNewColorMap();
    map.add([0, 0, 0, 0], id);
    expect(map.get(id)).not.toBeUndefined();
    expect(map.get(id)?.getAttribute()).toStrictEqual([0, 0, 0, 0]);
  });

  test("change color", async () => {
    const id = 1;
    const body = new ColorableMergedBody({ color: [0, 0, 0, 0] });
    const map = new TweenableColorMap("colors");

    map.add([0, 0, 0, 0], id);
    await body.geometryMerger.add(new BoxGeometry(1, 1, 1, 1, 1, 1), map, id);
    await body.geometryMerger.merge();

    const material = new ColorableMergedBodyMaterial(map);
    map.setMaterial(material as ShaderMaterial);
    body.material = material;

    expect(map).not.toBeUndefined();
    expect(map.get(id)?.getAttribute()).toStrictEqual([0, 0, 0, 0]);

    map.changeColor([1, 1, 1, 1], id, {
      duration: 1,
      now: 0,
      easing: TWEEN.Easing.Linear.None,
    });
    TweenableColorTicker.update(0);
    expect(map.get(id)?.getAttribute()).toStrictEqual([0, 0, 0, 0]);

    TweenableColorTicker.update(0.5);
    expect(map.get(id)?.getAttribute()).toStrictEqual([0.5, 0.5, 0.5, 0.5]);

    TweenableColorTicker.update(1);
    expect(map.get(id)?.getAttribute()).toStrictEqual([1, 1, 1, 1]);
  });
});
