import { FrontSide, NormalBlending, Vector4 } from "three";
import {
  MeshBasicNodeMaterial,
  ShaderNodeObject,
  UniformsNode,
  attribute,
  uniforms,
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

    //TODO add material.color and material.opacity
    this.colorNode = this.uniformsColorArray.element(
      attribute(ColorableMergedView.MODEL_INDEX) as unknown as number,
    );

    this.transparent = true;
    this.blending = param?.blending ?? NormalBlending;
    this.side = param?.side ?? FrontSide;

    colors.setMaterial(this);
    colors.updateUniformsAll();
  }

  static initColorUniformArray(colorLength: number) {
    return Array.from({ length: colorLength }, () => new Vector4(1, 1, 1, 0.5));
  }

  static initUniformsColorArray(vec4Array: Vector4[]) {
    return uniforms(vec4Array, "vec4");
  }
}
