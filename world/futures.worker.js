// One worker for the Possible Worlds Lab. Builds the town once per message, then either
// simulates a batch of futures (posting each as it finishes) or runs one interactive job
// (a branch, a twin, a person's life).
import { buildTown } from "./gen.js";
import { runFuture } from "./futures.js";

let stopped = false;
let cached = { key: null, town: null };

function townFor(origin, area, maxPeople) {
  const key = `${origin.lat},${origin.lng},${maxPeople},${area?.source || "none"},${area?.buildings?.length || 0}`;
  if (cached.key !== key) cached = { key, town: buildTown(origin, area, { maxPeople }) };
  return cached.town;
}

self.onmessage = async (ev) => {
  const msg = ev?.data || {};
  if (msg.type === "stop") { stopped = true; return; }
  const input = msg.input || {};
  try {
    const town = townFor(input.origin, input.area, input.maxPeople);
    if (msg.type === "run") {
      stopped = false;
      for (const index of input.indices || []) {
        if (stopped) break;
        const future = await runFuture({ town, plans: input.plans, index, baseSeed: input.baseSeed, years: input.years, step: input.step, assumptions: input.assumptions });
        self.postMessage({ type: "future", future });
      }
      self.postMessage({ type: "done" });
    } else if (msg.type === "job") {
      const future = await runFuture({
        town, plans: input.plans, index: input.index, baseSeed: input.baseSeed, years: input.years, step: input.step,
        assumptions: input.assumptions, override: input.override, reuse: input.reuse, collectPeople: !!input.collectPeople,
        onYear: ({ year }) => self.postMessage({ type: "progress", id: msg.id, year }),
      });
      self.postMessage({ type: "result", id: msg.id, future });
    }
  } catch (err) {
    self.postMessage({ type: "error", id: msg.id, error: String(err?.message || err) });
  }
};
