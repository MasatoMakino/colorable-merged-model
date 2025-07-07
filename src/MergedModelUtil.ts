import type { BufferGeometry } from "three";

export function readGeometryCount(geometry: BufferGeometry): number {
  return geometry.getAttribute("position").count;
}
