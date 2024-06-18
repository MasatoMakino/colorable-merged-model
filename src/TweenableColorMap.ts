import {
  TweenableColor,
  TweenableColorTicker,
} from "@masatomakino/tweenable-color";
import { Easing } from "@tweenjs/tween.js";
import { EventEmitter } from "eventemitter3";
import { ShaderMaterial, Vector4 } from "three";
import { IColorableMergedNodeMaterial } from "./material/index.js";

export class TweenableColorMap extends EventEmitter {
  readonly colors: Map<string, TweenableColor> = new Map();
  private material?: ShaderMaterial | IColorableMergedNodeMaterial;

  /**
   * コンストラクタ
   * @param uniformName このColorMapが操作するuniform名。マテリアル側に同名のuniformが必要。
   */
  constructor(readonly uniformName: string) {
    super();
    TweenableColorTicker.start();
  }

  setMaterial(material: ShaderMaterial | IColorableMergedNodeMaterial) {
    this.material = material;
  }

  static getColorMapKey(id: number): string {
    return `${id}`;
  }

  add(defaultColor: [number, number, number, number], id: number): void {
    const tweenableColor = new TweenableColor(
      defaultColor[0] * 255,
      defaultColor[1] * 255,
      defaultColor[2] * 255,
      defaultColor[3],
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
   * 指定されたidの色を変更する。
   * @param id
   * @param color max 1.0 ~ min 0.0 [r, g, b, a]
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

  public updateUniformsAll(): void {
    this.colors.forEach((color) => {
      this.updateUniform(color);
    });
  }

  /**
   * このカラーマップに紐づけられたマテリアルのuniformを更新する。
   * 対象となるuniformは、uniformNameで指定されたもの。
   *
   * @param tweenableColor
   * @private
   */
  private updateUniform(tweenableColor: TweenableColor): void {
    if (this.material == null) return;

    const getUniform = (
      material: ShaderMaterial | IColorableMergedNodeMaterial,
    ) => {
      if (material == null) return undefined;
      if (material instanceof ShaderMaterial) {
        return material.uniforms[this.uniformName].value as Vector4[];
      }
      return material.indexedColors;
    };
    const colorUniform = getUniform(this.material);

    if (colorUniform == null) {
      console.error(
        `対象のマテリアルに、${this.uniformName}という名前のuniformが存在しません。${this.material.name}のuniform生成処理にこの名前のuniformを追加してください。`,
      );
      return;
    }

    const index = this.getUniformIndexFromColor(tweenableColor);
    const colorAttribute = tweenableColor.getAttribute();
    colorUniform[index].set(...colorAttribute);
  }
}
