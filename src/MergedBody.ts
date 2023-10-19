import { ColorableMergedBodyParam } from "./ColorableMergedBody";
import { ColorableMergedBodyMaterial } from "./material";
import { BufferGeometry } from "three";
import { MergedModel } from "./MergedModel";

export class MergedBody extends MergedModel<ColorableMergedBodyParam> {
  protected override createMaterial() {
    this.object3D.material = new ColorableMergedBodyMaterial(
      this.colorMap.getSize(),
      this.option.materialSetting,
    );
  }
  protected override async convertGeometry(
    geometry: BufferGeometry,
    colorMapIndex: number,
  ) {
    geometry.deleteAttribute("uv");
    return geometry;
  }
}
