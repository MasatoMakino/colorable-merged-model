import { Color, PerspectiveCamera, Scene, WebGLRenderer } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import Stats from "three/examples/jsm/libs/stats.module.js";

const generateSceneObjects = (type: "webgl" | "webgpu") => {
  const w = 1280;
  const h = 720;
  const scene = new Scene();
  const camera = new PerspectiveCamera(45, w / h, 1, 60000);
  camera.position.set(0, 0, 15);

  const renderer =
    // type === "webgl"
    new WebGLRenderer({ antialias: true });

  renderer.setSize(w, h);
  renderer.setClearColor(new Color(0x000000));

  document.body.appendChild(renderer.domElement);
  const rendererInfo = document.createElement("div");
  document.body.appendChild(rendererInfo);
  new OrbitControls(camera, renderer.domElement);

  const stats = new Stats();
  const rendering = () => {
    stats.begin();
    renderer.render(scene, camera);
    stats.end();

    rendererInfo.innerText = JSON.stringify(renderer.info.render);
    requestAnimationFrame(rendering);
  };
  rendering();

  return { scene, camera };
};

export function generateScene() {
  return generateSceneObjects("webgl");
}

export function generateWebGPUScene() {
  return generateSceneObjects("webgpu");
}
