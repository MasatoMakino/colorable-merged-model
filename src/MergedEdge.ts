import { ColorableMergedEdgeParam } from "./ColorableMergedEdge";
import { ColorableMergedEdgeMaterial } from "./material";
import { BufferGeometry, EdgesGeometry } from "three";
import { MergedModel } from "./MergedModel";

export class MergedEdge extends MergedModel<ColorableMergedEdgeParam> {
  protected override createMaterial() {
    this.object3D.material = new ColorableMergedEdgeMaterial(
      this.colorMap.getSize(),
      this.option.materialSetting,
    );
  }

  protected override async convertGeometry(
    geometry: BufferGeometry,
    colorMapIndex: number,
  ) {
    return new EdgesGeometry(geometry, this.option.edgeDetail);
  }
}
