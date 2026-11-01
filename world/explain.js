// "Why did this happen?" for one possible reality.
//
// 1. Outcomes: the reality with and without the frozen plan (same seed → same events).
// 2. Causes: for each modeled proposal, re-run the plan WITHOUT it. What changes is that
//    proposal's contribution in this reality. Whatever the single removals don't account
//    for is reported as "together" (proposals that only matter in combination, or overlap).
// 3. People: every resident compared with themselves in the no-plan world, sorted by how
//    much their week changed, with the plan levers that explain it.
//
// Pure module: runs in a worker, the browser, or Bun.

import { simulateYear } from "./experiment.js";
import { METRICS, improvementSign } from "./paired.js";
import { planEffectsForYear, planForYear } from "./planspec.js";
import { realitySeed, snapshotToPlan } from "./multiverse.js";
import { POLICY_RULES } from "./policy.js";

const r3 = (x) => Math.round(x * 1000) / 1000;

// Which plan levers can move which outcome (from sim.js / experiment.js mechanics).
// Used only to phrase explanations; the numbers come from the leave-one-out runs.
const LEVER_TEXT = {
  speedAdd: "faster trips (transit)",
  floodMitigationAdd: "fewer homes flooded",
  housingGrowthAdd: "more housing",
  voucherMonthlyAdd: "monthly rent help for low-cash households",
  parkCleanupAdd: "faster park cleanup",
  restockBoostAdd: "more frequent restocking",
  hiringBoostAdd: "higher pay at small employers",
  groceryDeliveryAdd: "grocery deliveries to near-empty fridges",
};

export function leversOf(proposalId) {
  const rule = POLICY_RULES[proposalId];
  if (!rule) return [];
  return Object.keys(LEVER_TEXT).filter((k) => rule[k]).map((k) => LEVER_TEXT[k]);
}

function pick(outcomes) {
  const out = {};
  for (const k of Object.keys(METRICS)) out[k] = Number(outcomes?.[k] || 0);
  return out;
}

const PERSON_FIELDS = {
  walkMinutesPerDay: { label: "Walking", unit: "min/day", better: "lower" },
  mood: { label: "Mood", unit: "pts", better: "higher" },
  money: { label: "Money at week's end", unit: "$", better: "higher" },
  emptyFridgeDays: { label: "Days with an empty fridge", unit: "days", better: "lower" },
  soldOutHits: { label: "Times a shop was sold out", unit: "times", better: "lower" },
  dirtyParkVisits: { label: "Visits to a dirty park", unit: "visits", better: "lower" },
};

function personDiff(base, plan) {
  const changes = {};
  for (const [k, f] of Object.entries(PERSON_FIELDS)) {
    const d = plan[k] - base[k];
    changes[k] = { before: r3(base[k]), after: r3(plan[k]), delta: r3(d), good: !d ? 0 : (f.better === "lower" ? -Math.sign(d) : Math.sign(d)) };
  }
  if (base.displaced !== plan.displaced) changes.displaced = { before: base.displaced, after: plan.displaced, good: base.displaced ? 1 : -1 };
  // One number to rank residents: walking minutes saved, mood points, displacement avoided.
  const impact = -changes.walkMinutesPerDay.delta / 10 + changes.mood.delta / 2
    + (changes.displaced ? changes.displaced.good * 3 : 0)
    - changes.emptyFridgeDays.delta - changes.soldOutHits.delta * 0.5;
  return { changes, impact: r3(impact) };
}

/**
 * explainReality({ town, snapshot, index, baseSeed, year, onProgress })
 * Returns { reality, year, outcomes, causes, people, levers, notModeled }.
 */
export async function explainReality({ town, snapshot, index, baseSeed, year, maxPeople = 12, onProgress = null }) {
  const spec = snapshotToPlan(snapshot);
  const seed = realitySeed(baseSeed, index);
  const common = { town, year, seed, runSeed: seed, yearStartMs: 0, collectPeople: true };
  const { proposalIds, adoptedYearByProposal } = planForYear(spec, year);
  const total = 2 + proposalIds.length;
  let step = 0;
  const tick = () => onProgress?.({ step: ++step, total });

  const base = await simulateYear({ ...common, proposalIds: [], packageLabel: "No plan" }); tick();
  const full = proposalIds.length
    ? await simulateYear({ ...common, proposalIds, adoptedYearByProposal, packageLabel: spec.label })
    : base;
  tick();

  const b = pick(base.outcomes), f = pick(full.outcomes);
  const outcomes = {};
  for (const k of Object.keys(METRICS)) outcomes[k] = { ...METRICS[k], baseline: r3(b[k]), plan: r3(f[k]), delta: r3(f[k] - b[k]) };

  // Leave-one-out: each modeled proposal's contribution in THIS reality.
  const byProposal = [];
  for (const pid of proposalIds) {
    const rest = proposalIds.filter((x) => x !== pid);
    const without = await simulateYear({ ...common, proposalIds: rest, adoptedYearByProposal, packageLabel: `${spec.label} without ${pid}` });
    const w = pick(without.outcomes);
    const effect = {};
    for (const k of Object.keys(METRICS)) effect[k] = r3(f[k] - w[k]);
    const action = spec.actions.find((a) => a.proposalId === pid);
    byProposal.push({ proposalId: pid, label: action?.label || pid, levers: leversOf(pid), effect });
    tick();
  }

  const causes = {};
  for (const k of Object.keys(METRICS)) {
    const parts = byProposal
      .map((p) => ({ proposalId: p.proposalId, label: p.label, levers: p.levers, effect: p.effect[k], good: improvementSign(k, p.effect[k]) }))
      .filter((p) => Math.abs(p.effect) > 1e-9)
      .sort((x, y) => Math.abs(y.effect) - Math.abs(x.effect));
    const explained = parts.reduce((s, p) => s + p.effect, 0);
    causes[k] = { total: outcomes[k].delta, parts, together: r3(outcomes[k].delta - explained) };
  }

  // Residents: same person, same week, with and without the plan.
  const people = (full.people || []).map((p, i) => {
    const q = base.people[i];
    const { changes, impact } = personDiff(q, p);
    return { id: p.id, name: p.name, age: p.age, trait: p.trait, worker: p.worker, student: p.student, impact, changes };
  });
  const better = people.filter((p) => p.impact > 0).sort((a, z) => z.impact - a.impact);
  const worse = people.filter((p) => p.impact < 0).sort((a, z) => a.impact - z.impact);

  return {
    reality: index,
    seed,
    year,
    stormSeverity: r3(base.stormSeverity),
    population: people.length,
    outcomes,
    causes,
    levers: planEffectsForYear(spec, year),
    proposals: byProposal.map(({ proposalId, label, levers }) => ({ proposalId, label, levers })),
    notModeled: spec.actions.filter((a) => !a.simulated).map((a) => ({ id: a.proposalId, label: a.label })),
    people: {
      fields: PERSON_FIELDS,
      better: better.slice(0, maxPeople),
      worse: worse.slice(0, Math.ceil(maxPeople / 2)),
      counts: { better: better.length, worse: worse.length, same: people.length - better.length - worse.length },
    },
  };
}
