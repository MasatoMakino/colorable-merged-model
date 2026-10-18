// Runs benchmark conditions in fresh iframes, interleaved round by round, and
// exposes raw results on window.__results for extraction via DevTools.
interface BenchMessage {
  type: "bench-result";
  payload: Record<string, unknown>;
}

const params = new URLSearchParams(location.search);
const rounds = Number(params.get("rounds") ?? 5);
// Conditions are query strings separated by "|", e.g. "impl=A|impl=D&workers=4".
const conditions = (params.get("conds") ?? "impl=A").split("|");
const common = params.get("common") ?? "";

const state = {
  done: 0,
  total: rounds * conditions.length,
  results: [] as Record<string, unknown>[],
  finished: false,
};
(window as unknown as { __bench: typeof state }).__bench = state;

const statusEl = document.getElementById("status") as HTMLElement;

function runOne(query: string): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const frame = document.createElement("iframe");
    frame.width = "320";
    frame.height = "120";
    const onMessage = (e: MessageEvent<BenchMessage>) => {
      if (e.source !== frame.contentWindow || e.data?.type !== "bench-result") {
        return;
      }
      window.removeEventListener("message", onMessage);
      frame.remove();
      resolve(e.data.payload);
    };
    window.addEventListener("message", onMessage);
    frame.src = `bench.html?${query}${common ? `&${common}` : ""}`;
    document.body.appendChild(frame);
  });
}

async function main() {
  for (let r = 0; r < rounds; r++) {
    // Rotate the starting condition each round to spread drift evenly.
    for (let k = 0; k < conditions.length; k++) {
      const cond = conditions[(k + r) % conditions.length];
      const result = await runOne(cond);
      state.results.push({ round: r, cond, ...result });
      state.done++;
      statusEl.textContent = `${state.done} / ${state.total}`;
      await new Promise((res) => setTimeout(res, 500));
    }
  }
  state.finished = true;
  statusEl.textContent = `finished ${state.total}`;
}

void main();
