import GUI from "lil-gui";
import type { ColorSpace } from "three";
import type {
  ColorableMergedBodyNodeMaterial,
  ColorableMergedView,
} from "../src/index.js";
import { ColorSwitcher } from "./ColorSwitcher.js";
import { generateModel } from "./GenarateModel.js";
import { generateWebGPUScene } from "./GenerateScene.js";

const onDomContentsLoaded = async () => {
  const scene = generateWebGPUScene();
  const model: ColorableMergedView = await generateModel(20, "webgpu");
  scene.add(model);
  new ColorSwitcher(model);

  const gui = new GUI();
  const setting = {
    colorSpace: "srgb" as ColorSpace,
    applyGammaToAlpha: false,
  };
  const matBody = model.body?.material as ColorableMergedBodyNodeMaterial;
  const matEdge = model.edge?.material as ColorableMergedBodyNodeMaterial;
  const mats = [matBody, matEdge];
  gui
    .add(setting, "colorSpace", [
      "srgb",
      "srgb-linear",
      "display-p3",
      "display-p3-linear",
    ])
    .onChange((value) => {
      mats.forEach((mat) => {
        mat.colorSpace = value;
        mat.colors.updateUniformsAll();
      });
    });

  gui.add(setting, "applyGammaToAlpha").onChange((value) => {
    mats.forEach((mat) => {
      mat.applyGammaToAlpha = value;
      mat.colors.updateUniformsAll();
    });
  });
};

window.onload = onDomContentsLoaded;
