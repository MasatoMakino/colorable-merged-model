import { Color, Vector4 } from "three";
import {
  LineBasicNodeMaterial,
  ShaderNodeObject,
  UniformNode,
  UniformsNode,
  attribute,
  uniform,
} from "three/examples/jsm/nodes/Nodes.js";
import { TweenableColorMap } from "../TweenableColorMap.js";
import { ColorableMergedBodyNodeMaterial } from "./ColorableMergedBodyNodeMaterial.js";
import {
  ColorableMergedEdgeMaterialParam,
  IColorableMergedNodeMaterial,
} from "./index.js";
import { ColorableMergedView } from "../ColorableMergedView.js";

export class ColorableMergedEdgeNodeMaterial
  extends LineBasicNodeMaterial
  implements IColorableMergedNodeMaterial
{
  readonly isColorableMergedMaterial: boolean = true;
  readonly indexedColors: Vector4[];
  readonly uniformsColorArray: ShaderNodeObject<UniformsNode>;
  readonly materialColorUniform: ShaderNodeObject<UniformNode<Color>>;
  readonly materialOpacityUniform: ShaderNodeObject<UniformNode<number>>;

  constructor(
    readonly colors: TweenableColorMap,
    param?: ColorableMergedEdgeMaterialParam,
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

    this.materialColorUniform = uniform(this.color);
    this.materialOpacityUniform = uniform(this.opacity);
    this.depthWrite = param?.depthWrite ?? true;
    this.transparent = true;

    const colorElement = this.uniformsColorArray.element(
      attribute(ColorableMergedView.MODEL_INDEX) as unknown as number,
    );
    this.colorNode = this.materialColorUniform.mul(colorElement.xyz);
    this.opacityNode = this.materialOpacityUniform.mul(colorElement.w);

    colors.setMaterial(this);
    colors.updateUniformsAll();
  }
}
