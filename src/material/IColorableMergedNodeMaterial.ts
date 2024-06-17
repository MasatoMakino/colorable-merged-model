import { Vector4 } from "three";
import { UniformNode } from "three/examples/jsm/nodes/Nodes.js";
import { IColorableMergedMaterial } from "./IColorableMergedMaterial.js";

export interface IColorableMergedNodeMaterial extends IColorableMergedMaterial {
  readonly uniformColorArray: UniformNode<Vector4>[];
  name: string;
}
