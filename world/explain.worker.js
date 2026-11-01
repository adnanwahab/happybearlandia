// Runs explainReality() off the main thread for /world/reality.html.
import { buildTown } from "./gen.js";
import { explainReality } from "./explain.js";

self.onmessage = async (ev) => {
  const msg = ev?.data || {};
  if (msg.type !== "run") return;
  const { snapshot, origin, area, maxPeople, index, baseSeed, year } = msg.input || {};
  try {
    const town = buildTown(origin, area, { maxPeople });
    const result = await explainReality({
      town, snapshot, index, baseSeed, year,
      onProgress: (p) => self.postMessage({ type: "progress", ...p }),
    });
    self.postMessage({ type: "done", result });
  } catch (err) {
    self.postMessage({ type: "error", error: String(err?.message || err) });
  }
};
