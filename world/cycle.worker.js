// Run civic cycles off the main thread.
//
// Cycle 1: two identical copies of the visible town (same origin, area and seed).
// After a warm-up and a baseline day, one copy gets the plan and both run a week.
// Comparing "with plan" to "no plan" on the same seed isolates the plan's effect
// from the world's own drift.
//
// Cycle 2: residents of the plan world journal about their week. Those journals
// pick the next change (dear-congress if reachable, otherwise a local re-rank of
// complaints), which is layered on top of plan 1 in a forked copy of the plan world
// and compared against simply keeping plan 1 for another week.
//
// The sim is deterministic per seed, so forking = replaying the same history.

import { buildTown } from "./gen.js";
import { createWorld } from "./sim.js";
import { computeEffectsForYear, resolveRuleForProposal, POLICY_RULES } from "./policy.js";
import { journalFor, WALK_COMPLAINT_MINUTES } from "./journal.js";
import { createDayMeter, frictions, mean } from "./wellbeing.js";

const SAMPLE_EVERY = 10; // game minutes between mood samples
const WARMUP_DAYS = 3;   // the 3-day commute average starts at zero; warm it up first

// What each complaint is, and which simulated proposals can reach it.
// Grocery complaints split in two: empty shelves (small-business proposals add
// store deliveries) vs. an empty fridge at home (the grocery delivery program).
const COMPLAINTS = {
  transit: { label: "long commutes", fixes: ["t_bus", "t_brt"] },
  streets: { label: "dirty parks", fixes: ["s_311"] },
  flood: { label: "flooded homes", fixes: ["f_drainage", "f_buyouts"] },
  shelves: { label: "sold-out groceries", fixes: ["sb_payroll", "sb_filing"] },
  fridge: { label: "empty fridges at home", fixes: ["g_delivery"] },
};

let state = null; // kept between cycles so cycle 2 can continue cycle 1's worlds

function makeWorld({ origin, area, maxPeople }) {
  const town = buildTown(origin, area, { maxPeople });
  const world = createWorld(town);
  const byId = {};
  for (const b of town.buildings) { byId[b.index] = b; byId[String(b.index)] = b; }
  return { world, byId };
}

function applyPlan(w, proposalIds, year) {
  const staged = computeEffectsForYear(proposalIds, year);
  const e = staged.effects;
  Object.assign(w, {
    speedMult: e.speedMult,
    parkCleanupBoost: e.parkCleanupBoost,
    restockBoost: e.restockBoost,
    hiringBoost: e.hiringBoost,
    voucherMonthly: e.voucherMonthly,
    groceryDelivery: e.groceryDelivery,
  });
  return staged;
}

function recordDay(w) {
  const meter = createDayMeter(w.people.length);
  for (let m = 0; m < 1440; m += SAMPLE_EVERY) { w.step(SAMPLE_EVERY); meter.sample(w.people); }
  return meter.result(w.people);
}

// A world's full history: warm-up, baseline day, then one week per plan in
// `plans` (each week ends with a recorded day). The sim is deterministic, so
// replaying the same plan list reproduces a world exactly. That's how later
// cycles fork the plan world: replay every plan it has lived through so far.
async function replayHistory(env, plans, onDay) {
  const made = makeWorld(env);
  const w = made.world;
  for (let d = 0; d < WARMUP_DAYS; d++) { w.step(1440); await onDay?.(); }
  const before = recordDay(w);
  const journalsBefore = journals(w, made.byId);
  let after = before, staged = null;
  for (const ids of plans) {
    staged = applyPlan(w, ids, env.year);
    for (let d = 0; d < env.days - 1; d++) { w.step(1440); await onDay?.(); }
    after = recordDay(w);
  }
  return { ...made, before, after, journalsBefore, staged };
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

// How many residents had each problem yesterday (the thresholds journal.js complains at).
function complaintCounts(w) {
  const c = { transit: 0, streets: 0, flood: 0, shelves: 0, fridge: 0 };
  for (const p of w.people) {
    const d = p.yesterday || {};
    if (Number(p.walkMinutesAvg3d || 0) > WALK_COMPLAINT_MINUTES) c.transit++;
    if (Number(d.dirtyParkVisits || 0) >= 2) c.streets++;
    if (d.displaced || d.homeFlooded) c.flood++;
    if (Array.isArray(d.soldOutAt) && d.soldOutAt.length) c.shelves++;
    if (d.emptyFridge) c.fridge++;
  }
  return c;
}

const canonical = (ids) => new Set((ids || []).map((id) => resolveRuleForProposal(id)?.id).filter(Boolean));
const ruleLabel = (id) => POLICY_RULES[resolveRuleForProposal(id)?.id]?.label || id;

// Local stand-in for synthesis: the most-complained-about problem that some
// simulated proposal can still reach and plan 1 doesn't already include.
function localNextPlan(plan1Ids, counts) {
  const have = canonical(plan1Ids);
  const ranked = Object.entries(counts).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const unreachable = ranked
    .filter(([k]) => COMPLAINTS[k].fixes.length === 0)
    .map(([k, n]) => ({ id: k, label: COMPLAINTS[k].label, count: n }));
  for (const [k, n] of ranked) {
    // Prefer a fix that takes effect quickly; t_bus has no lag, t_brt has two years.
    const fix = COMPLAINTS[k].fixes.find((f) => !have.has(f));
    if (fix) return { add: [fix], target: { id: k, label: COMPLAINTS[k].label, count: n }, unreachable };
  }
  return { add: [], target: null, unreachable };
}

// Ask dear-congress for a re-synthesized plan given the residents' journals.
// Same request shape the 10-year experiment uses. Returns null if unreachable.
//
// dear-congress only adopts a challenger proposal after it wins 2 syntheses in a
// row (CHALLENGER_PERSISTENCE), so `previous` must be keyed by its own package id
// and the returned challengerStreak carried into the next cycle's request.
async function liveNextPlan({ remoteId, label, proposalIds, streak }, journalTexts, names) {
  const entries = [];
  const now = Date.now();
  journalTexts.forEach((text, i) => {
    if (text && entries.length < 24) entries.push({ text, author: names[i], createdAt: new Date(now - (entries.length % 24) * 60000).toISOString() });
  });
  const body = JSON.stringify({
    includeSynthetic: false,
    extraEntries: entries,
    previous: { [remoteId || label]: proposalIds },
    challengerStreak: { [remoteId || label]: streak || {} },
  });
  const post = () => fetch("/api/plan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    signal: AbortSignal.timeout(10000),
  });
  try {
    // One retry on a network error: after a long simulation the kept-alive
    // connection may have been closed by the server.
    const res = await post().catch(() => post());
    if (!res.ok) return null;
    const payload = await res.json();
    const rows = Array.isArray(payload) ? payload : payload?.packages || payload?.results || payload?.items || payload?.data?.packages || [];
    const needle = String(label || "").toLowerCase();
    const row = (remoteId && rows.find((r) => String(r?.id) === String(remoteId)))
      || rows.find((r) => String(r?.name || r?.title || r?.label || "").toLowerCase() === needle)
      || rows[0];
    if (!row) return null;
    const items = row.items || row.proposals || row.package?.items || [];
    const ids = [...new Set(items.map((it) => it?.proposal?.id || it?.proposalId || it?.id || it?.proposal_id).filter(Boolean))];
    const nextStreak = row.challengerStreak && typeof row.challengerStreak === "object" ? row.challengerStreak : {};
    // Proposals dear-congress is leaning toward but hasn't adopted yet.
    const warming = Object.entries(nextStreak)
      .filter(([id, n]) => !id.startsWith("__") && n > 0 && !ids.includes(id))
      .map(([id, n]) => ({ id, label: ruleLabel(id), streak: n }));
    return ids.length ? { proposalIds: ids, label: row.name || row.title || row.label || label, streak: nextStreak, warming } : null;
  } catch {
    return null;
  }
}

function resident(i, w, scores, j0, j1) {
  return {
    index: i,
    name: w.people[i].name,
    before: scores.before[i],
    noPlan: scores.noPlan[i],
    withPlan: scores.withPlan[i],
    journalBefore: j0[i],
    journalAfter: j1[i],
  };
}

function summarize(scores, worldNo, worldPlan, j0, j1) {
  const delta = scores.withPlan.map((x, i) => x - scores.noPlan[i]);
  let best = 0, worst = 0;
  for (let i = 1; i < delta.length; i++) {
    if (delta[i] > delta[best]) best = i;
    if (delta[i] < delta[worst]) worst = i;
  }
  return {
    avg: { before: mean(scores.before), noPlan: mean(scores.noPlan), withPlan: mean(scores.withPlan) },
    improved: delta.filter((x) => x > 5).length,
    worse: delta.filter((x) => x < -5).length,
    frictions: { noPlan: frictionAverages(worldNo), withPlan: frictionAverages(worldPlan) },
    best: resident(best, worldPlan, scores, j0, j1),
    worst: delta[worst] < -1 ? resident(worst, worldPlan, scores, j0, j1) : null,
  };
}

async function cycle1(payload, progress) {
  const env = {
    origin: payload.origin,
    area: payload.area,
    maxPeople: payload.maxPeople || 500,
    year: payload.year ?? 3,
    days: payload.days ?? 7,
  };
  const plan1Ids = payload.proposalIds || [];
  const totalDays = 2 * (WARMUP_DAYS + env.days);
  let done = 0;
  const tick = async (label) => { done++; progress(label(), done / totalDays); await null; };

  const base = await replayHistory(env, [[]], () => tick(() => "Simulating without the plan"));
  const plan = await replayHistory(env, [plan1Ids], () => tick(() => "Simulating with the plan"));
  const journalsAfter = journals(plan.world, plan.byId);
  const scores = { before: [...plan.before], noPlan: [...base.after], withPlan: [...plan.after] };

  state = {
    env, cycle: 1, history: [plan1Ids], plan1Ids, plan1Label: payload.label, remoteId: payload.remoteId || null, streak: {},
    planWorld: plan.world, planById: plan.byId, cycle1Scores: scores,
    hurtRef: { scores, plan: 1 }, // the last change, for "who did it hurt, and did the next change help?"
  };

  return {
    cycle: 1,
    days: env.days,
    year: env.year,
    proposalIds: plan1Ids,
    unsupported: plan.staged.unsupported,
    scores,
    ...summarize(scores, base.world, plan.world, plan.journalsBefore, journalsAfter),
  };
}

// The complaint a proposal answers, if residents are reporting it right now.
function complaintFor(proposalId, counts) {
  const id = resolveRuleForProposal(proposalId)?.id;
  if (!id) return null;
  const hits = Object.entries(counts)
    .filter(([k, n]) => n > 0 && COMPLAINTS[k].fixes.includes(id))
    .sort((a, b) => b[1] - a[1]);
  return hits.length ? { id: hits[0][0], label: COMPLAINTS[hits[0][0]].label, count: hits[0][1] } : null;
}

async function cycle2(progress) {
  if (!state) throw new Error("Run cycle 1 first");
  const { env, history, plan1Ids, plan1Label, remoteId, streak, planWorld, planById, cycle1Scores, hurtRef } = state;
  const n = (state.cycle || 1) + 1;

  progress("Reading residents' journals", 0.02);
  const counts = complaintCounts(planWorld);
  const journalsNow = journals(planWorld, planById);
  const local = localNextPlan(plan1Ids, counts);

  progress("Asking dear-congress for the next plan", 0.05);
  const live = await liveNextPlan({ remoteId, label: plan1Label, proposalIds: plan1Ids, streak }, journalsNow, planWorld.people.map((p) => p.name));
  const have = canonical(plan1Ids);
  const liveAdds = live ? [...canonical(live.proposalIds)].filter((id) => !have.has(id)) : [];
  // A proposal dear-congress is leaning toward that answers something residents report now.
  const pending = (live?.warming || [])
    .map((w) => ({ ...w, complaint: complaintFor(w.id, counts) }))
    .find((w) => w.complaint && !have.has(resolveRuleForProposal(w.id)?.id));

  let plan2Ids, source, note, waiting = null, target = null;
  if (live && liveAdds.length) {
    plan2Ids = live.proposalIds;
    source = "dear-congress";
    note = "dear-congress re-synthesized the plan from residents' journals";
    target = liveAdds.map((id) => complaintFor(id, counts)).find(Boolean) || null;
  } else if (pending) {
    // dear-congress adopts a change only after it wins two syntheses in a row.
    // Respect that instead of overriding it locally: hold the plan for a week.
    plan2Ids = plan1Ids;
    source = "dear-congress";
    waiting = { id: resolveRuleForProposal(pending.id)?.id || pending.id, label: pending.label, streak: pending.streak, needed: 2 };
    target = pending.complaint;
    note = `dear-congress is leaning toward ${pending.label} (${pending.streak} of 2 rounds). It changes the plan only after a second week of evidence, so the plan stays the same this week`;
  } else {
    plan2Ids = [...plan1Ids, ...local.add];
    source = "local";
    target = local.target;
    note = live
      ? "dear-congress kept the same simulated proposals, so the next fix was picked locally from the complaints"
      : "dear-congress wasn't reachable, so the next fix was picked locally from the complaints";
  }
  const before = canonical(plan1Ids), after = canonical(plan2Ids);
  const added = [...after].filter((id) => !before.has(id));
  const removed = [...before].filter((id) => !after.has(id));
  const changed = added.length > 0 || removed.length > 0;

  // Fork the plan world by replaying everything it has lived through, then give the
  // fork the new plan. If nothing simulated changed, the fork would be identical, so skip it.
  let fork = { world: planWorld, byId: planById };
  if (changed) {
    const forkTotal = WARMUP_DAYS + history.length * (env.days - 1);
    let forked = 0;
    fork = await replayHistory(env, history, async () => {
      forked++;
      progress(`Forking the plan ${n - 1} world`, 0.1 + 0.4 * (forked / forkTotal));
      await null;
    });
  }
  const staged = applyPlan(fork.world, plan2Ids, env.year);

  for (let d = 0; d < env.days - 1; d++) {
    progress(changed ? `Simulating day ${d + 1} of ${env.days}: plan ${n - 1} vs plan ${n}` : `Simulating day ${d + 1} of ${env.days}`, 0.5 + 0.48 * ((d + 1) / env.days));
    planWorld.step(1440);
    if (changed) fork.world.step(1440);
    await null;
  }
  const keep = recordDay(planWorld);
  const next = changed ? recordDay(fork.world) : keep;
  const scores = { before: cycle1Scores.withPlan, noPlan: [...keep], withPlan: [...next] };
  const j1 = journals(fork.world, fork.byId);

  // Follow up on whoever the last change hurt most: did this change help them?
  let followUp = null;
  if (changed) {
    const d0 = hurtRef.scores.withPlan.map((x, i) => x - hurtRef.scores.noPlan[i]);
    let hurt = 0;
    for (let i = 1; i < d0.length; i++) if (d0[i] < d0[hurt]) hurt = i;
    followUp = {
      index: hurt,
      name: planWorld.people[hurt].name,
      byPlan: hurtRef.plan,
      noPlan1: hurtRef.scores.noPlan[hurt],
      plan1: hurtRef.scores.withPlan[hurt],
      keepPlan1: keep[hurt],
      plan2: next[hurt],
    };
  }

  // The fork continues from here, so the next cycle builds on this plan.
  state = {
    ...state,
    cycle: n,
    history: [...history, plan2Ids],
    plan1Ids: plan2Ids,
    streak: live?.streak || streak,
    planWorld: fork.world,
    planById: fork.byId,
    cycle1Scores: scores,
    hurtRef: changed ? { scores, plan: n } : hurtRef,
  };

  return {
    cycle: n,
    days: env.days,
    year: env.year,
    proposalIds: plan2Ids,
    unsupported: staged.unsupported,
    source,
    note,
    waiting,
    added: added.map((id) => ({ id, label: ruleLabel(id) })),
    removed: removed.map((id) => ({ id, label: ruleLabel(id) })),
    target,
    unreachable: local.unreachable,
    complaints: Object.entries(counts).map(([id, count]) => ({ id, label: COMPLAINTS[id].label, count, reachable: COMPLAINTS[id].fixes.length > 0 })),
    followUp,
    scores,
    ...summarize(scores, planWorld, fork.world, journalsNow, j1),
  };
}

self.onmessage = async (ev) => {
  const msg = ev?.data || {};
  const progress = (stage, frac) => self.postMessage({ type: "progress", stage, frac });
  try {
    if (msg.type === "run") self.postMessage({ type: "done", result: await cycle1(msg.payload || {}, progress) });
    else if (msg.type === "next") self.postMessage({ type: "done", result: await cycle2(progress) });
  } catch (err) {
    self.postMessage({ type: "error", error: String(err?.message || err) });
  }
};
