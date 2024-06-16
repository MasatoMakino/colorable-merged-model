import { Vector4 } from "three";
import {
  ShaderNodeObject,
  UniformNode,
} from "three/examples/jsm/nodes/Nodes.js";
import { IColorableMergedMaterial } from "./IColorableMergedMaterial.js";

export interface IColorableMergedNodeMaterial extends IColorableMergedMaterial {
  readonly uniformColors: ShaderNodeObject<UniformNode<Vector4[]>>;
  name: string;
}
