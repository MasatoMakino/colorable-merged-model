import { BufferAttribute, BufferGeometry } from "three";

export function readGeometryCount(geometry: BufferGeometry): number {
  return geometry.getAttribute("position").count;
}

export function addColorAttribute(
  geometry: BufferGeometry,
  geometryCount: number,
  colorArray: number[]
): void {
  const floatArray = new Float32Array(geometryCount * 4).map((value, index) => {
    return colorArray[index % 4];
  });
  const colors = new BufferAttribute(floatArray, 4);
  geometry.setAttribute("color", colors);
}
