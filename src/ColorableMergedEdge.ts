import { LineSegments } from "three";
import { EdgeGeometryMerger } from "./index.js";

export interface ColorableMergedEdgeParam {
  edgeDetail?: number;
  color: [number, number, number, number];
}
export class ColorableMergedEdge extends LineSegments {
  readonly geometryMerger: EdgeGeometryMerger;
  constructor(option: ColorableMergedEdgeParam) {
    super();
    option.edgeDetail = option.edgeDetail ?? 7;
    this.geometryMerger = new EdgeGeometryMerger(this, option);
  }
}
