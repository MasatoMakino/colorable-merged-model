import { ColorableMergedView } from "../src/index.js";
import { generateModel } from "./GenarateModel.js";
import { generateScene } from "./GenerateScene.js";
import { ColorSwitcher } from "./ColorSwitcher.js";

const onDomContentsLoaded = async () => {
  const scene = generateScene();
  const model: ColorableMergedView = await generateModel(
    20,
    new URL("../dist/EdgeWorker.js", import.meta.url),
  );

  scene.add(model);
  new ColorSwitcher(model);
};

window.onload = onDomContentsLoaded;
