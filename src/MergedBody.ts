import { ColorableMergedBodyParam } from "./ColorableMergedBody";
import { ColorableMergedBodyMaterial } from "./material";
import { BufferGeometry } from "three";
import { MergedModel } from "./MergedModel";

export class MergedBody extends MergedModel<ColorableMergedBodyParam> {
  protected override async convertGeometry(geometry: BufferGeometry) {
    geometry.deleteAttribute("uv");
    return geometry;
  }
}
