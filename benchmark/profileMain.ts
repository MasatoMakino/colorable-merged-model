import { BoxGeometry, type BufferGeometry, TorusKnotGeometry } from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { FastEdgesGeometry } from "../src/FastEdgesGeometry.js";

/**
 * Standalone CPU-profiling entry for the current FastEdgesGeometry.
 *
 * Build:  npx tsc -p tsconfig.profile.json
 * Run:    node --cpu-prof --cpu-prof-dir=benchmark/profiles \
 *           .profile-build/benchmark/profileMain.js
 */
function createMergedBoxes(count: number): BufferGeometry {
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
  return BufferGeometryUtils.mergeGeometries(geometries, false);
}

const knot = new TorusKnotGeometry(10, 3, 800, 128);
const boxes = createMergedBoxes(10000);

// warmup
for (let i = 0; i < 3; i++) {
  new FastEdgesGeometry(knot, 1).dispose();
  new FastEdgesGeometry(boxes, 1).dispose();
}

const start = performance.now();
for (let i = 0; i < 15; i++) {
  new FastEdgesGeometry(knot, 1).dispose();
  new FastEdgesGeometry(boxes, 1).dispose();
}
console.log(`profiled loop: ${(performance.now() - start).toFixed(1)}ms`);
