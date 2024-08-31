import { Color, ColorSpace, Vector4 } from "three";
import {
  LineBasicNodeMaterial,
  ShaderNodeObject,
  UniformsNode,
  attribute,
  materialColor,
  materialOpacity,
} from "three/src/nodes/Nodes.js";
import { TweenableColorMap } from "../TweenableColorMap.js";
import { ColorableMergedBodyNodeMaterial } from "./ColorableMergedBodyNodeMaterial.js";
import {
  ColorableMergedEdgeMaterialParam,
  IColorableMergedNodeMaterial,
} from "./index.js";
import { ColorableMergedView } from "../ColorableMergedView.js";
import { TweenableColor } from "@masatomakino/tweenable-color";

export interface ColorableMergedEdgeNodeMaterialParam
  extends ColorableMergedEdgeMaterialParam {
  colorSpace?: ColorSpace;
  applyGammaToAlpha?: boolean;
}

export class ColorableMergedEdgeNodeMaterial
  extends LineBasicNodeMaterial
  implements IColorableMergedNodeMaterial
{
  readonly isColorableMergedMaterial: boolean = true;
  readonly indexedColors: Vector4[];
  readonly uniformsColorArray: ShaderNodeObject<UniformsNode>;

  protected readonly colorConverter = new Color();
  colorSpace: ColorSpace;
  applyGammaToAlpha: boolean;

  constructor(
    readonly colors: TweenableColorMap,
    param?: ColorableMergedEdgeNodeMaterialParam,
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

    this.depthWrite = param?.depthWrite ?? true;
    this.transparent = true;
    this.colorSpace = param?.colorSpace ?? "srgb";
    this.applyGammaToAlpha = param?.applyGammaToAlpha ?? false;

    const colorElement = this.uniformsColorArray.element(
      attribute(ColorableMergedView.MODEL_INDEX) as unknown as number,
    );
    this.colorNode = materialColor.mul(colorElement.xyz);
    this.opacityNode = materialOpacity.mul(colorElement.w);

    colors.setMaterial(this);
    colors.updateUniformsAll();
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
}
