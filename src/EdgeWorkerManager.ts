export class EdgeWorkerManager {
  static #workerURL: string | URL;
  static #workers: Worker[] = [];
  static #workerIndex = 0;
  static setWorkerURL(url: string | URL): void {
    if (this.#workerURL) throw new Error("Worker URL is already set.");

    this.#workerURL = url;
    const nativeProcess = window.navigator.hardwareConcurrency ?? 4;

    for (let i = 0; i < nativeProcess; i++) {
      this.#workers.push(new Worker(url));
    }
  }

  static getWorker(): Worker | undefined {
    if (this.#workers.length === 0) return undefined;

    const worker = this.#workers[this.#workerIndex];
    this.#workerIndex = this.#workerIndex++ % this.#workers.length;
    return worker;
  }
}
