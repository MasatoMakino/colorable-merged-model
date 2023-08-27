import { ColorableMergedView } from "../";
import { generateModel } from "./GenarateModel";
import { generateScene } from "./GenerateScene";
import { ColorSwitcher } from "./ColorSwitcher";

const onDomContentsLoaded = async () => {
  /**
   *   TODO リロードのたびに色の組み合わせが変わる。実行順が保証されていない。
   *   プロセス数が1だと色の組み合わせが変わらない。スタックの解消順に問題がある。
   *   スタックが多いと色の組み合わせが変わらない。
   *   失敗する時はedgeの色だけが変わる。bodyには影響がない。
   */
  const model: ColorableMergedView = await generateModel(
    2,
    new URL("../dist/EdgeWorker.js", import.meta.url),
  );

  const scene = generateScene();
  scene.add(model);
  new ColorSwitcher(model);
};

window.onload = onDomContentsLoaded;
