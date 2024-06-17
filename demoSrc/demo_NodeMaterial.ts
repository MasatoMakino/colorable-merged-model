import { ColorableMergedView } from "../src/index.js";
import { generateModel } from "./GenarateModel.js";
import { generateWebGPUScene } from "./GenerateScene.js";
import { ColorSwitcher } from "./ColorSwitcher.js";

const onDomContentsLoaded = async () => {
  const scene = generateWebGPUScene();
  const model: ColorableMergedView = await generateModel(20, "webgpu");
  scene.add(model);
  new ColorSwitcher(model);
};

window.onload = onDomContentsLoaded;
