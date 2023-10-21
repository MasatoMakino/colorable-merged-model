import {
  TweenableColor,
  TweenableColorTicker,
} from "@masatomakino/tweenable-color";
import { Easing } from "@tweenjs/tween.js";
import { EventEmitter } from "eventemitter3";
import { Material, Vector4 } from "three";
import {
  ColorableMergedBody,
  ColorableMergedEdge,
  ColorableMergedMaterial,
} from "./index.js";

export class TweenableColorMap extends EventEmitter {
  readonly colors: Map<string, TweenableColor> = new Map();
  private model?: ColorableMergedEdge | ColorableMergedBody;

  constructor(readonly uniformName: string) {
    super();
    TweenableColorTicker.start();
  }

  setMergedModel(model: ColorableMergedEdge | ColorableMergedBody) {
    this.model = model;
    this.model.onBeforeRender = this.updateColorAttribute;
  }

  static getColorMapKey(id: number): string {
    return `${id}`;
  }

  addColor(defaultColor: [number, number, number, number], id: number): void {
    const color = defaultColor;
    const tweenableColor = new TweenableColor(
      color[0] * 255,
      color[1] * 255,
      color[2] * 255,
      color[3],
    );

    this.colors.set(TweenableColorMap.getColorMapKey(id), tweenableColor);
    tweenableColor.on("onUpdate", this.onChangedColor); // TODO ここをアップデートトリガーからuniformの直接上書きに変更する。スロットリングは必要ない。
  }

  get(id: number): TweenableColor | undefined {
    return this.colors.get(TweenableColorMap.getColorMapKey(id));
  }

  getIndex(id: number): number {
    return [...this.colors.keys()].indexOf(
      TweenableColorMap.getColorMapKey(id),
    );
  }

  getSize(): number {
    return this.colors.size;
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
      duration?: number;
      easing?: (t: number) => number;
      now?: number;
    },
  ): void {
    option = option ?? {};
    option.now ??= performance.now();
    option.duration ??= 1000;
    option.easing ??= Easing.Cubic.Out;

    const tweenableColor = this.get(id);

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
    const mat = this.model?.material as unknown as ColorableMergedMaterial;
    if (mat?.isColorableMergedMaterial !== true) return;

    let count = 0;
    this.colors.forEach((value) => {
      const colorArray = value.getAttribute();

      const colors = mat.uniforms[this.uniformName].value as Vector4[];
      colors[count].set(
        colorArray[0],
        colorArray[1],
        colorArray[2],
        colorArray[3],
      );

      count++;
    });
    (this.model?.material as Material).needsUpdate = true;
  };
}
