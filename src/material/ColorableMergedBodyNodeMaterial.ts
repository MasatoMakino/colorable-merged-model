import { FrontSide, NormalBlending, Vector4 } from "three";
import {
  MeshBasicNodeMaterial,
  ShaderNodeObject,
  UniformNode,
  uniform,
} from "three/examples/jsm/nodes/Nodes.js";
import { TweenableColorMap } from "../TweenableColorMap.js";
import { ColorableMergedBodyMaterialParam } from "./ColorableMergedBodyMaterial.js";
import { IColorableMergedNodeMaterial } from "./IColorableMergedNodeMaterial.js";

export class ColorableMergedBodyNodeMaterial
  extends MeshBasicNodeMaterial
  implements IColorableMergedNodeMaterial
{
  readonly isColorableMergedMaterial: boolean = true;

  readonly uniformColors: ShaderNodeObject<UniformNode<Vector4[]>>;

  constructor(
    readonly colors: TweenableColorMap,
    param?: ColorableMergedBodyMaterialParam,
  ) {
    super();
    if (colors.getSize() === 0) {
      throw new Error(`ColorableMergedNodeMaterialには少なくとも1つ以上のTweenableColorが必要です。
          このMaterialに紐づけられたTweenableColoMapには1つもTweenableColorが登録されていません。`);
    }

    this.uniformColors = ColorableMergedBodyNodeMaterial.getColorUniform(
      colors.getSize(),
    );

    this.transparent = true;
    this.blending = param?.blending ?? NormalBlending;
    this.side = param?.side ?? FrontSide;

    colors.setMaterial(this);
    colors.updateUniformsAll();
  }

  static getColorUniform(colorLength: number) {
    const colors = new Array(colorLength)
      .fill(0)
      .map(() => new Vector4(1, 1, 1, 0.5));

    return uniform(colors);
  }
}
