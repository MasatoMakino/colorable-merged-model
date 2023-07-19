import { BoxGeometry, PerspectiveCamera, Scene, WebGLRenderer } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import Stats from "three/examples/jsm/libs/stats.module";
import { ColorableMergedView } from "../";

const generateScene = () => {
  const w = 1280;
  const h = 720;
  const scene = new Scene();
  const camera = new PerspectiveCamera(45, w / h, 1, 60000);
  camera.position.set(0, 0, 15);

  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setSize(w, h);
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
    renderer.render(scene, camera);
    requestAnimationFrame(rendering);
  };
  rendering();

  return scene;
};

const generateModel = () => {
  const view: ColorableMergedView = new ColorableMergedView({
    bodyOption: { color: [1, 1, 1, 0.2] },
    edgeOption: { color: [1, 1, 1, 0.8] },
  });

  const n = 20;
  const addModel = (x: number, y: number, z: number) => {
    const size = 0.1;
    const geo = new BoxGeometry(size, size, size);

    const getQuadrant = (i: number): number => {
      return i < n / 2 ? -1 : 1;
    };
    const index = getQuadrant(x) * getQuadrant(y) * getQuadrant(z);
    const calcPos = (i: number) => {
      return (i - n / 2) * (size * 3);
    };
    geo.translate(calcPos(x), calcPos(y), calcPos(z));
    view.addGeometry(geo, index);
  };

  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      for (let z = 0; z < n; z++) {
        addModel(x, y, z);
      }
    }
  }

  view.merge();
  return view;
};

const onDomContentsLoaded = () => {
  const scene = generateScene();
  const model: ColorableMergedView = generateModel();
  scene.add(model);

  let isOn = true;

  const switchColor = () => {
    isOn = !isOn;

    const OnBodyColor: [number, number, number, number] = [1, 1, 1, 0.2];
    const OffBodyColor01: [number, number, number, number] = [1, 0, 0, 0.2];
    const OffBodyColor02: [number, number, number, number] = [0, 1, 0, 0.2];

    const OnEdgeColor: [number, number, number, number] = [1, 1, 1, 0.8];
    const OffEdgeColor01: [number, number, number, number] = [1, 0, 0, 0.8];
    const OffEdgeColor02: [number, number, number, number] = [0, 1, 0, 0.8];

    model.changeColor({
      bodyColor: isOn ? OnBodyColor : OffBodyColor01,
      edgeColor: isOn ? OnEdgeColor : OffEdgeColor01,
      id: 1,
    });

    model.changeColor({
      bodyColor: isOn ? OnBodyColor : OffBodyColor02,
      edgeColor: isOn ? OnEdgeColor : OffEdgeColor02,
      id: -1,
    });
  };
  setInterval(switchColor, 3000);
  switchColor();
};

window.onload = onDomContentsLoaded;
