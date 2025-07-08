import type { TweenableColor } from "@masatomakino/tweenable-color";
import {
  Color,
  type ColorSpace,
  FrontSide,
  NormalBlending,
  Vector4,
} from "three";
import {
  attribute,
  MeshBasicNodeMaterial,
  materialColor,
  materialOpacity,
  type ShaderNodeObject,
  type UniformsNode,
  uniforms,
} from "three/src/nodes/Nodes.js";
import { ColorableMergedView } from "../ColorableMergedView.js";
import type { TweenableColorMap } from "../TweenableColorMap.js";
import type {
  ColorableMergedBodyMaterialParam,
  IColorableMergedNodeMaterial,
} from "./index.js";

export interface ColorableMergedNodeBodyMaterialParam
  extends ColorableMergedBodyMaterialParam {
  colorSpace?: ColorSpace;
  applyGammaToAlpha?: boolean;
}

export class ColorableMergedBodyNodeMaterial
  extends MeshBasicNodeMaterial
  implements IColorableMergedNodeMaterial
{
  readonly isColorableMergedMaterial: boolean = true;
  readonly indexedColors: Vector4[] = [];
  readonly uniformsColorArray: ShaderNodeObject<UniformsNode>;

  protected readonly colorConverter = new Color();
  colorSpace: ColorSpace;
  applyGammaToAlpha: boolean;

  constructor(
    readonly colors: TweenableColorMap,
    param?: ColorableMergedNodeBodyMaterialParam,
  ) {
    super();
    if (colors.getSize() === 0) {
      throw new Error(`ColorableMergedNodeMaterialには少なくとも1つ以上のTweenableColorが必要です。
          このMaterialに紐づけられたTweenableColoMapには1つもTweenableColorが登録されていません。`);
    }

    this.indexedColors = ColorableMergedBodyNodeMaterial.initColorUniformArray(
      colors.getSize(),
    );
    this.uniformsColorArray =
      ColorableMergedBodyNodeMaterial.initUniformsColorArray(
        this.indexedColors,
      );

    const colorElement = this.uniformsColorArray.element(
      attribute(ColorableMergedView.MODEL_INDEX) as unknown as number,
    );
    this.colorNode = materialColor.mul(colorElement.xyz);
    this.opacityNode = materialOpacity.mul(colorElement.w);

    this.transparent = true;
    this.blending = param?.blending ?? NormalBlending;
    this.side = param?.side ?? FrontSide;
    this.colorSpace = param?.colorSpace ?? "srgb";
    this.applyGammaToAlpha = param?.applyGammaToAlpha ?? false;

    colors.setMaterial(this);
    colors.updateUniformsAll();
  }

  static initColorUniformArray(colorLength: number) {
    return Array.from({ length: colorLength }, () => new Vector4(1, 1, 1, 1));
  }

  static initUniformsColorArray(vec4Array: Vector4[]) {
    return uniforms(vec4Array, "vec4");
  }

  /**
   * 指定されたuniformを更新する。
   * @param tweenableColor
   */
  updateUniform(tweenableColor: TweenableColor): void {
    ColorableMergedBodyNodeMaterial.updateUniform(
      this.colors,
      tweenableColor,
      this.indexedColors,
      this.colorSpace,
      this.applyGammaToAlpha,
      this.colorConverter,
    );
  }

  /**
   * 指定されたuniformを更新する。
   *
   * @param colorMap
   *   tweenableColorMapインスタンス
   * @param tweenableColor
   *   更新するTweenableColorインスタンス。TweenableColorMapに登録されている必要がある。
   * @param indexedColors
   *   マテリアルのuniformに設定されているVector4配列
   * @param colorSpace
   *   colorSpace色空間が指定されている場合、RGBAの各要素をワーキングカラースペースに変換する。
   * @param applyGammaToAlpha
   *   アルファチャンネルを色空間の変換対象にするか否か。
   * @param colorTransform
   *   colorSpaceが指定されている場合に、色空間の変換に使うColorインスタンス。
   *   再利用のために引数で渡すことを推奨する。
   */
  static updateUniform(
    colorMap: TweenableColorMap,
    tweenableColor: TweenableColor,
    indexedColors: Vector4[],
    colorSpace: ColorSpace,
    applyGammaToAlpha: boolean,
    colorTransform?: Color,
  ): void {
    const index = colorMap.getUniformIndexFromColor(tweenableColor);
    const colorAttribute = tweenableColor.getAttribute();
    const targetVec4 = indexedColors[index];

    targetVec4.set(...colorAttribute);

    if (colorSpace != null && colorSpace !== "") {
      colorTransform ??= new Color();
      colorTransform.setRGB(
        colorAttribute[0],
        colorAttribute[1],
        colorAttribute[2],
        colorSpace,
      );
      targetVec4.setX(colorTransform.r);
      targetVec4.setY(colorTransform.g);
      targetVec4.setZ(colorTransform.b);

      if (applyGammaToAlpha) {
        colorTransform.setRGB(colorAttribute[3], 0, 0, colorSpace);
        targetVec4.setW(colorTransform.r);
      }
    }
  }
}
