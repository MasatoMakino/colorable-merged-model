import { ColorableMergedEdgeParam, FastEdgesGeometry } from "../index.js";
import { BufferGeometry, EdgesGeometry } from "three";
import { GeometryMerger } from "./GeometryMerger.js";

export class EdgeGeometryMerger extends GeometryMerger<ColorableMergedEdgeParam> {
  protected override async convert(geometry: BufferGeometry) {
    if (this.option.useFastEdgesGeometry) {
      return new FastEdgesGeometry(geometry, this.option.edgeDetail);
    }
    return new EdgesGeometry(geometry, this.option.edgeDetail);
  }
}
