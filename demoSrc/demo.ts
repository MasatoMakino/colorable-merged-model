import { BoxGeometry, PerspectiveCamera, Scene, WebGLRenderer } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { ColorableMergedModel } from "../";

const onDomContentsLoaded = () => {
  const w = 1280;
  const h = 720;
  const scene = new Scene();
  const camera = new PerspectiveCamera(45, w / h, 1, 60000);
  camera.position.set(0, 0, 15);

  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setSize(w, h);
  document.body.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);

  const rendering = () => {
    renderer.render(scene, camera);
    requestAnimationFrame(rendering);
  };
  rendering();

  const model = new ColorableMergedModel({
    bodyOption: { color: [1, 1, 1, 0.2] },
    edgeOption: { color: [1, 1, 1, 0.8] },
  });
  scene.add(model);

  const n = 20;
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      for (let z = 0; z < n; z++) {
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
        model.addModel(geo, index);
      }
    }
  }

  model.generate();

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
