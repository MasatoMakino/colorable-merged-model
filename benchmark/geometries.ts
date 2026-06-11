import {
  BoxGeometry,
  type BufferGeometry,
  SphereGeometry,
  TorusKnotGeometry,
} from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Geometry staircase for benchmarking and accuracy measurement.
 *
 * Large geometries are required: with simple geometries, hash-collision-induced
 * edge detection errors do not surface when compared against the original
 * EdgesGeometry. Collision probability grows with edge count.
 */
export interface BenchGeometryEntry {
  name: string;
  /** Approximate triangle count, for reporting. */
  create: () => BufferGeometry;
}

export function triangleCount(geometry: BufferGeometry): number {
  const index = geometry.getIndex();
  const count = index ? index.count : geometry.getAttribute("position").count;
  return count / 3;
}

/**
 * Merge `count` unit boxes arranged in a 3D grid into a single indexed geometry.
 * Mimics the library's real use case (ColorableMergedView merges many small
 * geometries): low vertex sharing across boxes and high edge density.
 */
export function createMergedBoxes(count: number): BufferGeometry {
  const gridSize = Math.ceil(Math.cbrt(count));
  const geometries: BufferGeometry[] = [];
  for (let i = 0; i < count; i++) {
    const x = i % gridSize;
    const y = Math.floor(i / gridSize) % gridSize;
    const z = Math.floor(i / (gridSize * gridSize));
    const box = new BoxGeometry(1, 1, 1);
    box.translate(x * 2, y * 2, z * 2);
    geometries.push(box);
  }
  const merged = BufferGeometryUtils.mergeGeometries(geometries, false);
  for (const g of geometries) {
    g.dispose();
  }
  return merged;
}

/**
 * Array of individual translated unit boxes, NOT merged.
 * Mirrors the library's per-source code path: EdgeGeometryMerger.convert()
 * constructs one edge geometry per added source geometry before merging.
 */
export function createBoxArray(count: number): BufferGeometry[] {
  const gridSize = Math.ceil(Math.cbrt(count));
  const geometries: BufferGeometry[] = [];
  for (let i = 0; i < count; i++) {
    const x = i % gridSize;
    const y = Math.floor(i / gridSize) % gridSize;
    const z = Math.floor(i / (gridSize * gridSize));
    const box = new BoxGeometry(1, 1, 1);
    box.translate(x * 2, y * 2, z * 2);
    geometries.push(box);
  }
  return geometries;
}

export const benchGeometries: BenchGeometryEntry[] = [
  {
    name: "TorusKnot(10,3,200,32) ~12.8k tri",
    create: () => new TorusKnotGeometry(10, 3, 200, 32),
  },
  {
    name: "TorusKnot(10,3,800,128) ~204.8k tri",
    create: () => new TorusKnotGeometry(10, 3, 800, 128),
  },
  {
    name: "Sphere(1,512,512) ~522k tri",
    create: () => new SphereGeometry(1, 512, 512),
  },
  {
    name: "MergedBoxes(1000) 12k tri",
    create: () => createMergedBoxes(1000),
  },
  {
    name: "MergedBoxes(10000) 120k tri",
    create: () => createMergedBoxes(10000),
  },
  {
    name: "TorusKnot(10,3,800,128) nonIndexed",
    create: () => new TorusKnotGeometry(10, 3, 800, 128).toNonIndexed(),
  },
  {
    name: "MergedBoxes(10000) nonIndexed",
    create: () => createMergedBoxes(10000).toNonIndexed(),
  },
];
