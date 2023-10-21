import {
  TweenableColor,
  TweenableColorTicker,
} from "@masatomakino/tweenable-color";
import { Easing } from "@tweenjs/tween.js";
import { EventEmitter } from "eventemitter3";
import { ShaderMaterial, Vector4 } from "three";

export class TweenableColorMap extends EventEmitter {
  readonly colors: Map<string, TweenableColor> = new Map();
  private material?: ShaderMaterial;

  constructor(readonly uniformName: string) {
    super();
    TweenableColorTicker.start();
  }

  setMaterial(material: ShaderMaterial) {
    this.material = material;
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

  getUniformIndex(id: number): number {
    return [...this.colors.keys()].indexOf(
      TweenableColorMap.getColorMapKey(id),
    );
  }

  getUniformIndexFromColor(color: TweenableColor): number {
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
    if (this.material == null) return;

    const colorUniform = this.material.uniforms[this.uniformName]
      .value as Vector4[];
    const index = this.getUniformIndexFromColor(tweenableColor);
    const attribute = tweenableColor.getAttribute();

    colorUniform[index].set(
      attribute[0],
      attribute[1],
      attribute[2],
      attribute[3],
    );
  }
}
