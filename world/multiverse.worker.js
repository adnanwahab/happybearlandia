// One worker in the realities pool. Builds the town once, then simulates the reality
// indices it is given and posts each result as soon as it finishes.
import { buildTown } from "./gen.js";
import { runReality, snapshotToPlan } from "./multiverse.js";

let stopped = false;

self.onmessage = async (ev) => {
  const msg = ev?.data || {};
  if (msg.type === "stop") { stopped = true; return; }
  if (msg.type !== "run") return;

  const { snapshot, origin, area, maxPeople, indices, baseSeed, checkpoints } = msg.input || {};
  try {
    const town = buildTown(origin, area, { maxPeople });
    const spec = snapshotToPlan(snapshot);
    for (const index of indices || []) {
      if (stopped) break;
      const reality = await runReality({ town, spec, index, baseSeed, checkpoints });
      self.postMessage({ type: "reality", reality });
    }
    self.postMessage({ type: "done" });
  } catch (err) {
    self.postMessage({ type: "error", error: String(err?.message || err) });
  }
};
