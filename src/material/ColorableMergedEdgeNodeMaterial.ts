import { Vector4 } from "three";
import {
  LineBasicNodeMaterial,
  ShaderNodeObject,
  UniformNode,
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
  readonly uniformColors: ShaderNodeObject<UniformNode<Vector4[]>>;

  constructor(
    readonly colors: TweenableColorMap,
    param?: ColorableMergedEdgeMaterialParam,
  ) {
    super();

    this.uniformColors = ColorableMergedBodyNodeMaterial.getColorUniform(
      colors.getSize(),
    );
    this.depthWrite = param?.depthWrite ?? true;
    this.transparent = true;

    //TODO : update colorNode

    //TODO : update alphaNode

    colors.setMaterial(this);
    colors.updateUniformsAll();
  }
}
