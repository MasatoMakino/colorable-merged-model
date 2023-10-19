import { ColorableMergedEdgeParam } from "./ColorableMergedEdge";
import { BufferGeometry, EdgesGeometry } from "three";
import { MergedModel } from "./MergedModel";

export class MergedEdge extends MergedModel<ColorableMergedEdgeParam> {
  protected override async convertGeometry(
    geometry: BufferGeometry,
    colorMapIndex: number,
  ) {
    return new EdgesGeometry(geometry, this.option.edgeDetail);
  }
}
