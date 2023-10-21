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
  private model?: ColorableMergedEdge | ColorableMergedBody; //TODO 参照先をmodelではなくmaterialにする。

  constructor(readonly uniformName: string) {
    super();
    TweenableColorTicker.start();
  }

  //TODO : 削除 arrtibuteの更新が頻繁に発生しないため。
  setMergedModel(model: ColorableMergedEdge | ColorableMergedBody) {
    this.model = model;
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
    tweenableColor.on("onUpdate", () => {
      this.updateUniform(tweenableColor);
    });
  }

  get(id: number): TweenableColor | undefined {
    return this.colors.get(TweenableColorMap.getColorMapKey(id));
  }

  getIndex(id: number): number {
    return [...this.colors.keys()].indexOf(
      TweenableColorMap.getColorMapKey(id),
    );
  }

  getIndexFromColor(color: TweenableColor): number {
    return [...this.colors.values()].indexOf(color);
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

  private updateUniform(tweenableColor: TweenableColor): void {
    const mat = this.model?.material as unknown as ColorableMergedMaterial;
    if (mat?.isColorableMergedMaterial !== true) return;

    const colorUniform = mat.uniforms[this.uniformName].value as Vector4[];
    const index = this.getIndexFromColor(tweenableColor);
    const attribute = tweenableColor.getAttribute();

    colorUniform[index].set(
      attribute[0],
      attribute[1],
      attribute[2],
      attribute[3],
    );
  }
}
