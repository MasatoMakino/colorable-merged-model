import {
  TweenableColor,
  TweenableColorTicker,
} from "@masatomakino/tweenable-color";
import { Easing } from "@tweenjs/tween.js";
import { EventEmitter } from "eventemitter3";
export class TweenableColorMap extends EventEmitter {
  constructor(model) {
    super();
    this.model = model;
    this.colors = new Map();
    this.needUpdateColors = false;
    this.onChangedColor = () => {
      this.needUpdateColors = true;
    };
    this.updateColorAttribute = () => {
      if (!this.needUpdateColors) return;
      this.needUpdateColors = false;
      this.forceUpdateColorAttribute();
    };
    this.forceUpdateColorAttribute = () => {
      const mat = this.model.material;
      let count = 0;
      this.colors.forEach((value) => {
        const colorArray = value.getAttribute();
        mat.setColor(count, colorArray);
        count++;
      });
      this.model.material.needsUpdate = true;
    };
    this.model.onBeforeRender = this.updateColorAttribute;
    TweenableColorTicker.start();
  }
  static getColorMapKey(id, type = "default") {
    return `${type}__${id}`;
  }
  addColor(defaultColor, id, type) {
    const color = defaultColor;
    const tweenableColor = new TweenableColor(
      color[0] * 255,
      color[1] * 255,
      color[2] * 255,
      color[3],
    );
    this.set(tweenableColor, id, type);
  }
  set(color, id, type) {
    this.colors.set(TweenableColorMap.getColorMapKey(id, type), color);
    color.on("onUpdate", this.onChangedColor);
  }
  get(id, type) {
    return this.colors.get(TweenableColorMap.getColorMapKey(id, type));
  }
  /**
   * 指定されたジオメトリの色を変更する
   * @param id
   * @param color
   * @param type
   */
  changeColor(color, id, type) {
    const now = performance.now();
    const tweenableColor = this.get(id, type);
    tweenableColor === null || tweenableColor === void 0
      ? void 0
      : tweenableColor.change(
          color[0] * 255,
          color[1] * 255,
          color[2] * 255,
          color[3],
          1000,
          { easing: Easing.Cubic.Out, startTime: now },
        );
  }
}
