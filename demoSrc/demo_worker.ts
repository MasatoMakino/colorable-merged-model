import { ColorableMergedView } from "../";
import { generateModel } from "./GenarateModel";
import { generateScene } from "./GenerateScene";
import { ColorSwitcher } from "./ColorSwitcher";

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
