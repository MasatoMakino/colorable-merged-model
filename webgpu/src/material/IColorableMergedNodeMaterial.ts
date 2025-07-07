import type { TweenableColor } from "@masatomakino/tweenable-color";
import type { ColorSpace, Vector4 } from "three";
import type { ShaderNodeObject, UniformsNode } from "three/src/nodes/Nodes.js";
import type { IColorableMergedMaterial } from "./IColorableMergedMaterial.js";

export interface IColorableMergedNodeMaterial extends IColorableMergedMaterial {
  readonly indexedColors: Vector4[];
  readonly uniformsColorArray: ShaderNodeObject<UniformsNode>;
  name: string;
  updateUniform(tweenableColor: TweenableColor): void;
  /**
   * indexedColorsに注入される色空間
   * defaultは"srgb"
   *
   * シェーダー内部では、RGB値はColorManagement.workingColorSpaceの値で処理される。
   * ColorManagement.workingのデフォルトはsrgb-linear
   * このNodeMaterialは、シェーダーに渡す前に色をワーキングカラースペースの空間に変換する。
   */
  colorSpace: ColorSpace;
  /**
   * アルファ値にガンマ補正を適用するかどうか。defaultはfalse。
   * Photoshopのように、アルファ値にガンマ補正を適用する場合はtrueにする。
   */
  applyGammaToAlpha: boolean;
}
