import { Color, FrontSide, NormalBlending, Vector4, ColorSpace } from "three";
import {
  MeshBasicNodeMaterial,
  ShaderNodeObject,
  UniformsNode,
  attribute,
  uniforms,
  materialColor,
  materialOpacity,
} from "three/examples/jsm/nodes/Nodes.js";
import { ColorableMergedView } from "../ColorableMergedView.js";
import { TweenableColorMap } from "../TweenableColorMap.js";
import {
  ColorableMergedBodyMaterialParam,
  IColorableMergedNodeMaterial,
} from "./index.js";
import { TweenableColor } from "@masatomakino/tweenable-color";

export interface ColorableMergedNodeBodyMaterialParam
  extends ColorableMergedBodyMaterialParam {
  colorSpace?: ColorSpace;
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
      this.colorConverter,
    );
  }

  static updateUniform(
    colorMap: TweenableColorMap,
    tweenableColor: TweenableColor,
    indexedColors: Vector4[],
    colorSpace?: ColorSpace,
    colorTransform?: Color,
  ): void {
    const index = colorMap.getUniformIndexFromColor(tweenableColor);
    const colorAttribute = tweenableColor.getAttribute();

    indexedColors[index].set(...colorAttribute);
    if (colorSpace != null && colorSpace !== "") {
      colorTransform ??= new Color();
      colorTransform.setRGB(
        colorAttribute[0],
        colorAttribute[1],
        colorAttribute[2],
        colorSpace,
      );

      indexedColors[index].set(
        colorTransform.r,
        colorTransform.g,
        colorTransform.b,
        colorAttribute[3],
      );
    }
  }
}
