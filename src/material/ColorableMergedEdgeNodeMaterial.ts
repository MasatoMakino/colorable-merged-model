import { Vector4 } from "three";
import {
  LineBasicNodeMaterial,
  ShaderNodeObject,
  UniformsNode,
} from "three/examples/jsm/nodes/Nodes.js";
import { TweenableColorMap } from "../TweenableColorMap.js";
import { ColorableMergedBodyNodeMaterial } from "./ColorableMergedBodyNodeMaterial.js";
import {
  ColorableMergedEdgeMaterialParam,
  IColorableMergedNodeMaterial,
} from "./index.js";

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

    this.indexedColors = ColorableMergedBodyNodeMaterial.initColorUniformArray(
      colors.getSize(),
    );
    this.uniformsColorArray =
      ColorableMergedBodyNodeMaterial.initUniformsColorArray(
        this.indexedColors,
      );
    this.depthWrite = param?.depthWrite ?? true;
    this.transparent = true;

    //TODO : update colorNode

    //TODO : update alphaNode

    colors.setMaterial(this);
    colors.updateUniformsAll();
  }
}
