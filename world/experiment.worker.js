import { buildTown } from "./gen.js";
import { runExperiment } from "./experiment.js";

function normalizePackages(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.packages || payload?.results || payload?.items || payload?.data?.packages || payload?.data?.results || [];
}

async function fetchPlanRemote(body) {
  const res = await fetch("/api/plan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) throw new Error(`plan HTTP ${res.status}`);
  const payload = await res.json();
  return normalizePackages(payload);
}

self.onmessage = async (ev) => {
  const msg = ev?.data || {};
  if (msg.type !== "run") return;

  const { origin, area, maxPeople, years = 10, seed = "world-exp" } = msg.payload || {};
  try {
    const town = buildTown(origin, area, { maxPeople: maxPeople || 500 });
    const packageNames = ["Balanced", "Minimal change", "Most popular"];
    const results = {};

    for (let i = 0; i < packageNames.length; i++) {
      const packageName = packageNames[i];
      const history = [];
      const plansByYear = [];
      await runExperiment({
        town,
        packageName,
        years,
        seed,
        fetchPlan: fetchPlanRemote,
        onYear: ({ year, proposalIds, outcomes }) => {
          history.push({ year, outcomes });
          plansByYear.push({ year, proposalIds });
          self.postMessage({
            type: "progress",
            packageName,
            year,
            years,
            donePackages: i,
            totalPackages: packageNames.length,
          });
        },
      });
      results[packageName] = { history, plansByYear };
    }

    self.postMessage({ type: "done", results });
  } catch (err) {
    self.postMessage({ type: "error", error: String(err?.message || err) });
  }
};
