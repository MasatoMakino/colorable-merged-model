import { Vector4 } from "three";
import {
  ShaderNodeObject,
  UniformsNode,
} from "three/examples/jsm/nodes/Nodes.js";
import { IColorableMergedMaterial } from "./IColorableMergedMaterial.js";

export interface IColorableMergedNodeMaterial extends IColorableMergedMaterial {
  readonly indexedColors: Vector4[];
  readonly uniformsColorArray: ShaderNodeObject<UniformsNode>;
  name: string;
}
