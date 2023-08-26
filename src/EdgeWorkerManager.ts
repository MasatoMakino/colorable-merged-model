import EventEmitter from "eventemitter3";
import { BufferGeometry } from "three";
import { EdgeGenerationResponse } from "./EdgeWorkerMessage";

export class EdgeWorkerManager {
  static get workerURL(): string | URL {
    return EdgeWorkerManager.#workerURL;
  }
  static #workerURL: string | URL;
  static #workers: Worker[] = [];
  static #workerIndex = 0;
  static emitter = new EventEmitter();

  static requestStack: { geometry: BufferGeometry; detail: number }[] = [];

  public static setWorkerURL(url: string | URL): void {
    if (this.#workerURL) throw new Error("Worker URL is already set.");

    this.#workerURL = url;
    const nativeProcess = window.navigator.hardwareConcurrency ?? 4;

    for (let i = 0; i < nativeProcess; i++) {
      const urlString = typeof url === "string" ? url : url.toString();
      const worker = new Worker(urlString, { name: `edge_${i}` });
      this.#workers.push(worker);
      worker.addEventListener(
        "message",
        (e: MessageEvent<EdgeGenerationResponse>) => {
          this.emitter.emit("response", e.data);
        },
      );
    }
  }

  private static getWorker(): Worker | undefined {
    if (this.#workers.length === 0) return undefined;

    const worker = this.#workers[this.#workerIndex];
    this.#workerIndex = this.#workerIndex++ % this.#workers.length;
    return worker;
  }

  //TODO requestを即時実行ではなく、キューに積んで、workerが空いたら実行するようにする
  static request(geometry: BufferGeometry, detail: number): void {
    const worker = this.getWorker();
    if (!worker) return;

    const copyAttribute = (name: string) => {
      const attr = geometry.getAttribute(name);
      return attr.array as Float32Array;
    };
    const message = {
      position: copyAttribute("position"),
      normal: copyAttribute("normal"),
      index: (geometry.getIndex()!.array as Uint16Array | Uint32Array).slice(),
      detail,
      geometryID: geometry.id,
    };
    worker.postMessage(message);
  }
}
