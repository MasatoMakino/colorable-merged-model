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
   * @param option
   */
  changeColor(color, id, option) {
    var _a, _b, _c;
    option = option !== null && option !== void 0 ? option : {};
    (_a = option.now) !== null && _a !== void 0
      ? _a
      : (option.now = performance.now());
    (_b = option.duration) !== null && _b !== void 0
      ? _b
      : (option.duration = 1000);
    (_c = option.easing) !== null && _c !== void 0
      ? _c
      : (option.easing = Easing.Cubic.Out);
    const tweenableColor = this.get(
      id,
      option === null || option === void 0 ? void 0 : option.type,
    );
    tweenableColor === null || tweenableColor === void 0
      ? void 0
      : tweenableColor.change(
          color[0] * 255,
          color[1] * 255,
          color[2] * 255,
          color[3],
          option.duration,
          { easing: option.easing, startTime: option.now },
        );
  }
}
