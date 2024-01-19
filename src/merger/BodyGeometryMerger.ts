import { ColorableMergedBodyParam } from "../index.js";
import { BufferGeometry } from "three";
import { GeometryMerger } from "./GeometryMerger.js";

export class BodyGeometryMerger extends GeometryMerger<ColorableMergedBodyParam> {
  protected override async convert(geometry: BufferGeometry) {
    geometry.deleteAttribute("uv");
    return geometry;
  }
}
