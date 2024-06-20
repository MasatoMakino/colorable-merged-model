import { Vector4 } from "three";
import {
  LineBasicNodeMaterial,
  ShaderNodeObject,
  UniformsNode,
  attribute,
  materialColor,
  materialOpacity,
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

    this.depthWrite = param?.depthWrite ?? true;
    this.transparent = true;

    const colorElement = this.uniformsColorArray.element(
      attribute(ColorableMergedView.MODEL_INDEX) as unknown as number,
    );
    this.colorNode = materialColor.mul(colorElement.xyz);
    this.opacityNode = materialOpacity.mul(colorElement.w);

    colors.setMaterial(this);
    colors.updateUniformsAll();
  }
}
