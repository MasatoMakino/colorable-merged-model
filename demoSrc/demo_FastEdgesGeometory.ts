import {
  AdditiveBlending,
  BufferGeometry,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  TorusKnotGeometry,
} from "three";
import { generateScene } from "./GenerateScene";
import { FastEdgesGeometry } from "../src";
import GUI from "lil-gui";

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
  gui.add(obj, "thresholdAngle", 0, 10, 0.1).onChange((value: number) => {
    regenerateEdges();
  });
  gui.add(obj, "tubularSegments", 4, 400, 1).onChange((value: number) => {
    regenerateEdges();
  });
  gui.add(obj, "radialSegments", 4, 128, 1).onChange((value: number) => {
    regenerateEdges();
  });
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