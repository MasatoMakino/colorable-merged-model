import {
  TweenableColor,
  TweenableColorTicker,
} from "@masatomakino/tweenable-color";
import { Easing } from "@tweenjs/tween.js";
import { EventEmitter } from "eventemitter3";
import { Material } from "three";
import {
  ColorableMergedBody,
  ColorableMergedEdge,
  IColorableMergedMaterial,
} from "./index.js";

export class TweenableColorMap extends EventEmitter {
  readonly colors: Map<string, TweenableColor> = new Map();

  constructor(private model: ColorableMergedEdge | ColorableMergedBody) {
    super();
    this.model.onBeforeRender = this.updateColorAttribute;
    TweenableColorTicker.start();
  }
  static getColorMapKey(id: number, type: string = "default"): string {
    return `${type}__${id}`;
  }

  addColor(
    defaultColor: [number, number, number, number],
    id: number,
    type?: string,
  ): void {
    const color = defaultColor;
    const tweenableColor = new TweenableColor(
      color[0] * 255,
      color[1] * 255,
      color[2] * 255,
      color[3],
    );
    this.set(tweenableColor, id, type);
  }
  protected set(color: TweenableColor, id: number, type?: string) {
    this.colors.set(TweenableColorMap.getColorMapKey(id, type), color);
    color.on("onUpdate", this.onChangedColor);
  }

  get(id: number, type?: string): TweenableColor | undefined {
    return this.colors.get(TweenableColorMap.getColorMapKey(id, type));
  }

  /**
   * 指定されたジオメトリの色を変更する
   * @param id
   * @param color
   * @param option
   */
  changeColor(
    color: [number, number, number, number],
    id: number,
    option?: {
      type?: string;
      duration?: number;
      easing?: (t: number) => number;
      now?: number;
    },
  ): void {
    option = option ?? {};
    option.now ??= performance.now();
    option.duration ??= 1000;
    option.easing ??= Easing.Cubic.Out;

    const tweenableColor = this.get(id, option?.type);
    tweenableColor?.change(
      color[0] * 255,
      color[1] * 255,
      color[2] * 255,
      color[3],
      option.duration,
      { easing: option.easing, startTime: option.now },
    );
  }

  private needUpdateColors = false;
  private onChangedColor = () => {
    this.needUpdateColors = true;
  };

  private updateColorAttribute = () => {
    if (!this.needUpdateColors) return;
    this.needUpdateColors = false;
    this.forceUpdateColorAttribute();
  };

  public forceUpdateColorAttribute = () => {
    const mat = this.model.material as unknown as IColorableMergedMaterial;
    let count = 0;
    this.colors.forEach((value) => {
      const colorArray = value.getAttribute();
      mat.setColor(count, colorArray);
      count++;
    });
    (this.model.material as Material).needsUpdate = true;
  };
}
