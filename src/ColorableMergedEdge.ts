import { LineSegments } from "three";
import { ColorableMergedEdgeMaterialParam, MergedEdge } from "./index.js";

export interface ColorableMergedEdgeParam {
  edgeDetail?: number;
  color: [number, number, number, number];
}
export class ColorableMergedEdge extends LineSegments {
  readonly model: MergedEdge;
  constructor(option: ColorableMergedEdgeParam) {
    super();
    option.edgeDetail = option.edgeDetail ?? 7;
    this.model = new MergedEdge(this, option);
  }
}
