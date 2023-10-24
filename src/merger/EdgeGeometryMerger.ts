import { ColorableMergedEdgeParam } from "../index.js";
import { BufferGeometry, EdgesGeometry } from "three";
import { GeometryMerger } from "./GeometryMerger";

export class EdgeGeometryMerger extends GeometryMerger<ColorableMergedEdgeParam> {
  protected override async convert(geometry: BufferGeometry) {
    return new EdgesGeometry(geometry, this.option.edgeDetail);
  }
}
