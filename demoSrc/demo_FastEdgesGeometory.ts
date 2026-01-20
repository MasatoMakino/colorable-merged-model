import GUI from "lil-gui";
import {
  AdditiveBlending,
  BoxGeometry,
  type BufferGeometry,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  SphereGeometry,
  TorusKnotGeometry,
} from "three";
import { FastEdgesGeometry } from "../src";
import { generateScene } from "./GenerateScene";

interface BenchmarkResult {
  geometry: string;
  triangles: number;
  edgesTime: number;
  fastEdgesTime: number;
  speedup: number;
  iterations: number;
}

const runBenchmark = (
  geometry: BufferGeometry,
  thresholdAngle: number,
  iterations: number = 100,
): BenchmarkResult => {
  const edgesTimes: number[] = [];
  const fastTimes: number[] = [];

  // Warmup for JIT optimization
  for (let i = 0; i < 10; i++) {
    new EdgesGeometry(geometry, thresholdAngle);
    new FastEdgesGeometry(geometry, thresholdAngle);
  }

  // Measurement
  for (let i = 0; i < iterations; i++) {
    const start1 = performance.now();
    new EdgesGeometry(geometry, thresholdAngle);
    edgesTimes.push(performance.now() - start1);

    const start2 = performance.now();
    new FastEdgesGeometry(geometry, thresholdAngle);
    fastTimes.push(performance.now() - start2);
  }

  // Use median to reduce outlier impact
  const median = (arr: number[]) => {
    const sorted = [...arr].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  };

  const indexAttr = geometry.getIndex();
  const positionAttr = geometry.getAttribute("position");
  const indexCount = indexAttr ? indexAttr.count : positionAttr.count;

  return {
    geometry: geometry.type,
    triangles: Math.floor(indexCount / 3),
    edgesTime: median(edgesTimes),
    fastEdgesTime: median(fastTimes),
    speedup: median(edgesTimes) / median(fastTimes),
    iterations,
  };
};

const runFullBenchmark = () => {
  console.log("Running full benchmark...");
  const results = [
    runBenchmark(new BoxGeometry(1, 1, 1), 1),
    runBenchmark(new SphereGeometry(1, 32, 32), 1),
    runBenchmark(new TorusKnotGeometry(10, 3, 200, 32), 1),
    runBenchmark(new TorusKnotGeometry(10, 3, 400, 64), 1),
  ];
  console.table(results);
  return results;
};

const onDomContentsLoaded = async () => {
  const { scene, camera } = generateScene();

  const geometry = new TorusKnotGeometry(10, 3, 200, 32);
  const { edges, fastEdges } = generateEdges(geometry);

  const edgesMesh = new LineSegments(
    edges,
    new LineBasicMaterial({ color: 0xff0000, blending: AdditiveBlending }),
  );
  const fastEdgesMesh = new LineSegments(
    fastEdges,
    new LineBasicMaterial({ color: 0x00ffff, blending: AdditiveBlending }),
  );
  edgesMesh.position.x = -20;
  fastEdgesMesh.position.x = 20;

  camera.position.z = 60;
  scene.add(edgesMesh, fastEdgesMesh);

  const gui = new GUI();
  const obj = {
    distance: 20,
    radialSegments: 32,
    tubularSegments: 200,
    thresholdAngle: 1,
  };
  gui.add(obj, "distance", 0, 20, 0.05).onChange((value: number) => {
    edgesMesh.position.x = -value;
    fastEdgesMesh.position.x = value;
  });
  gui.add(obj, "thresholdAngle", 0, 10, 0.1).onChange(() => {
    regenerateEdges();
  });
  gui.add(obj, "tubularSegments", 4, 400, 1).onChange(() => {
    regenerateEdges();
  });
  gui.add(obj, "radialSegments", 4, 128, 1).onChange(() => {
    regenerateEdges();
  });
  gui.add({ runFullBenchmark }, "runFullBenchmark").name("Run Full Benchmark");
  const regenerateEdges = () => {
    const geometry = new TorusKnotGeometry(
      10,
      3,
      obj.tubularSegments,
      obj.radialSegments,
    );
    const { edges, fastEdges } = generateEdges(geometry, obj.thresholdAngle);
    edgesMesh.geometry.dispose();
    fastEdgesMesh.geometry.dispose();
    edgesMesh.geometry = edges;
    fastEdgesMesh.geometry = fastEdges;
  };
};

const generateEdges = (
  geometry: BufferGeometry,
  thresholdAngle: number = 1,
) => {
  const startEdges = performance.now();
  const edges = new EdgesGeometry(geometry, thresholdAngle);
  const endEdges = performance.now();
  const timeEdges = endEdges - startEdges;
  console.log(`EdgesGeometry: ${timeEdges}ms`);

  const start = performance.now();
  const fastEdges = new FastEdgesGeometry(geometry, thresholdAngle, {
    seed: 0,
  });
  const end = performance.now();
  const time = end - start;
  console.log(`FastEdgesGeometry: ${time}ms`);

  if (timeEdges / time < 1) {
    console.warn(
      `🚫 FastEdgesGeometry is slower than EdgesGeometry. FastEdgesGeometry is ${timeEdges / time} times slower than EdgesGeometry.`,
    );
  } else {
    console.log(
      `👍 FastEdgesGeometry is ${timeEdges / time} times faster than EdgesGeometry.`,
    );
  }

  return { edges, fastEdges };
};

window.onload = onDomContentsLoaded;
