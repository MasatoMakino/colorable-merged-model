import { Vector4 } from "three";
import {
  LineBasicNodeMaterial,
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
  readonly uniformColors: UniformNode<Vector4>[] = [];

  constructor(
    readonly colors: TweenableColorMap,
    param?: ColorableMergedEdgeMaterialParam,
  ) {
    super();

    ColorableMergedBodyNodeMaterial.initColorUniformArray(
      colors.getSize(),
      this.uniformColors,
    );
    this.depthWrite = param?.depthWrite ?? true;
    this.transparent = true;

    //TODO : update colorNode

    //TODO : update alphaNode

    colors.setMaterial(this);
    colors.updateUniformsAll();
  }
}
