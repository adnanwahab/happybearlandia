// Run one civic cycle off the main thread.
//
// Builds two identical copies of the visible town (same origin, area and seed),
// records one baseline day, applies the plan package to one copy only, runs both
// for a week, then records a final day. Comparing "with plan" to "no plan" on the
// same seed isolates the plan's effect from the world's own drift.

import { buildTown } from "./gen.js";
import { createWorld } from "./sim.js";
import { computeEffectsForYear } from "./policy.js";
import { journalFor } from "./journal.js";
import { createDayMeter, frictions, mean } from "./wellbeing.js";

const SAMPLE_EVERY = 10; // game minutes between mood samples

function makeWorld(origin, area, maxPeople) {
  const town = buildTown(origin, area, { maxPeople });
  const world = createWorld(town);
  const byId = {};
  for (const b of town.buildings) { byId[b.index] = b; byId[String(b.index)] = b; }
  return { world, byId };
}

function recordDay(w) {
  const meter = createDayMeter(w.people.length);
  for (let m = 0; m < 1440; m += SAMPLE_EVERY) { w.step(SAMPLE_EVERY); meter.sample(w.people); }
  return meter.result(w.people);
}

function journals(w, byId) {
  // Journal about the day that just finished, the same way the live world does.
  return w.people.map((p) => journalFor({ ...p, today: p.yesterday || p.today }, { buildingsById: byId }) || "");
}

function frictionAverages(w) {
  const out = { commute: 0, home: 0, groceries: 0, parks: 0 };
  const n = w.people.length || 1;
  for (const p of w.people) { const f = frictions(p); for (const k in out) out[k] += f[k] / n; }
  return out;
}

self.onmessage = async (ev) => {
  const msg = ev?.data || {};
  if (msg.type !== "run") return;
  const { origin, area, maxPeople = 500, proposalIds = [], year = 3, days = 7 } = msg.payload || {};
  try {
    const progress = (stage, frac) => self.postMessage({ type: "progress", stage, frac });

    const base = makeWorld(origin, area, maxPeople);
    const plan = makeWorld(origin, area, maxPeople);
    const a = base.world, b = plan.world;

    // Warm up first: the 3-day commute average starts at zero, so an unwarmed
    // baseline would look rosier than any later day and mislead the "Before" number.
    progress("Warming up the town", 0);
    for (let d = 0; d < 3; d++) { a.step(1440); b.step(1440); await null; }

    progress("Recording a baseline day", 0.2);
    recordDay(a);
    const before = recordDay(b);
    const journalsBefore = journals(b, plan.byId);

    const staged = computeEffectsForYear(proposalIds, year);
    const e = staged.effects;
    Object.assign(b, {
      speedMult: e.speedMult,
      parkCleanupBoost: e.parkCleanupBoost,
      restockBoost: e.restockBoost,
      hiringBoost: e.hiringBoost,
      voucherMonthly: e.voucherMonthly,
    });

    const runDays = Math.max(1, days - 1);
    for (let d = 0; d < runDays; d++) {
      progress(`Simulating day ${d + 1} of ${days}`, 0.2 + (0.8 * (d + 1)) / (runDays + 1));
      a.step(1440);
      b.step(1440);
      await null; // let progress messages flush
    }

    progress(`Recording day ${days}`, 0.97);
    const noPlan = recordDay(a);
    const withPlan = recordDay(b);
    const journalsAfter = journals(b, plan.byId);

    const delta = [...withPlan].map((x, i) => x - noPlan[i]);
    let best = 0, worst = 0;
    for (let i = 1; i < delta.length; i++) {
      if (delta[i] > delta[best]) best = i;
      if (delta[i] < delta[worst]) worst = i;
    }
    const resident = (i) => ({
      index: i,
      name: b.people[i].name,
      before: before[i],
      noPlan: noPlan[i],
      withPlan: withPlan[i],
      journalBefore: journalsBefore[i],
      journalAfter: journalsAfter[i],
    });

    self.postMessage({
      type: "done",
      result: {
        days,
        year,
        unsupported: staged.unsupported,
        effects: e,
        scores: { before: [...before], noPlan: [...noPlan], withPlan: [...withPlan] },
        avg: { before: mean([...before]), noPlan: mean([...noPlan]), withPlan: mean([...withPlan]) },
        improved: delta.filter((x) => x > 5).length,
        worse: delta.filter((x) => x < -5).length,
        frictions: { noPlan: frictionAverages(a), withPlan: frictionAverages(b) },
        best: resident(best),
        worst: delta[worst] < -1 ? resident(worst) : null,
      },
    });
  } catch (err) {
    self.postMessage({ type: "error", error: String(err?.message || err) });
  }
};
