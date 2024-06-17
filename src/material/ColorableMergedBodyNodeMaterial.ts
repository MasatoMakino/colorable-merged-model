import { FrontSide, NormalBlending, Vector4 } from "three";
import {
  MeshBasicNodeMaterial,
  ShaderNodeObject,
  UniformNode,
  uniform,
  attribute,
  float,
  vec3,
  vec4,
  uniforms,
  tslFn,
} from "three/examples/jsm/nodes/Nodes.js";
import { TweenableColorMap } from "../TweenableColorMap.js";
import {
  ColorableMergedBodyMaterialParam,
  IColorableMergedNodeMaterial,
} from "./index.js";
import { ColorableMergedView } from "../ColorableMergedView.js";

export class ColorableMergedBodyNodeMaterial
  extends MeshBasicNodeMaterial
  implements IColorableMergedNodeMaterial
{
  readonly isColorableMergedMaterial: boolean = true;
  readonly uniformColorArray: UniformNode<Vector4>[] = [];

  constructor(
    readonly colors: TweenableColorMap,
    param?: ColorableMergedBodyMaterialParam,
  ) {
    super();
    if (colors.getSize() === 0) {
      throw new Error(`ColorableMergedNodeMaterialには少なくとも1つ以上のTweenableColorが必要です。
          このMaterialに紐づけられたTweenableColoMapには1つもTweenableColorが登録されていません。`);
    }

    ColorableMergedBodyNodeMaterial.initColorUniformArray(
      colors.getSize(),
      this.uniformColorArray,
    );

    //TODO : update colorNode
    const uniform = this.uniformColorArray[0];
    this.colorNode = vec3(uniform).xyz;

    //TODO : update alphaNode
    this.opacityNode = vec4(uniform).w;

    this.transparent = true;
    this.blending = param?.blending ?? NormalBlending;
    this.side = param?.side ?? FrontSide;

    colors.setMaterial(this);
    colors.updateUniformsAll();
  }

  static initColorUniformArray(
    colorLength: number,
    uniformColorArray: UniformNode<Vector4>[] = [],
  ) {
    for (let i = 0; i < colorLength; i++) {
      uniformColorArray.push(uniform(new Vector4(1, 1, 1, 0.5)));
    }
  }
}
