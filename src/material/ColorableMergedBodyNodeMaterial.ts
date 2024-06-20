import { Color, FrontSide, NormalBlending, Vector4 } from "three";
import {
  MeshBasicNodeMaterial,
  ShaderNodeObject,
  UniformNode,
  UniformsNode,
  attribute,
  uniform,
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

export class ColorableMergedBodyNodeMaterial
  extends MeshBasicNodeMaterial
  implements IColorableMergedNodeMaterial
{
  readonly isColorableMergedMaterial: boolean = true;
  readonly indexedColors: Vector4[] = [];
  readonly uniformsColorArray: ShaderNodeObject<UniformsNode>;

  constructor(
    readonly colors: TweenableColorMap,
    param?: ColorableMergedBodyMaterialParam,
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

    colors.setMaterial(this);
    colors.updateUniformsAll();
  }

  static initColorUniformArray(colorLength: number) {
    return Array.from({ length: colorLength }, () => new Vector4(1, 1, 1, 1));
  }

  static initUniformsColorArray(vec4Array: Vector4[]) {
    return uniforms(vec4Array, "vec4");
  }
}
