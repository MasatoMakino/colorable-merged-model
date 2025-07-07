import type { BufferGeometry } from "three";
import type { ColorableMergedBodyParam } from "../index.js";
import { GeometryMerger } from "./GeometryMerger.js";

export class BodyGeometryMerger extends GeometryMerger<ColorableMergedBodyParam> {
  protected override async convert(geometry: BufferGeometry) {
    geometry.deleteAttribute("uv");
    return geometry;
  }
}
