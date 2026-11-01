import { hashSeed, rng } from "./gen.js";
import { createWorld } from "./sim.js";
import { journalFor } from "./journal.js";
import { computeEffectsForYear } from "./policy.js";

function cloneTown(town) {
  return {
    ...town,
    buildings: (town.buildings || []).map((b) => ({
      ...b,
      poly: Array.isArray(b.poly) ? b.poly.map((p) => [p[0], p[1]]) : [],
      center: Array.isArray(b.center) ? [b.center[0], b.center[1]] : [0, 0],
      state: b.state ? { ...b.state } : {},
      mesh: null,
    })),
    people: (town.people || []).map((p) => ({
      ...p,
      needs: { ...(p.needs || {}) },
    })),
    roads: (town.roads || []).map((r) => ({
      ...r,
      pts: Array.isArray(r.pts) ? r.pts.map((p) => [p[0], p[1]]) : [],
    })),
  };
}

function packageRows(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.packages || payload?.results || payload?.items || payload?.data?.packages || payload?.data?.results || [];
}

function proposalIdFrom(item) {
  return item?.proposal?.id || item?.proposalId || item?.id || item?.proposal_id || null;
}

function pickPackage(payload, packageName) {
  const rows = packageRows(payload);
  const nameNeedle = String(packageName || "").toLowerCase().trim();
  if (!rows.length) return null;
  const found = rows.find((r) => {
    const name = String(r?.name || r?.title || r?.label || "").toLowerCase();
    return name === nameNeedle;
  }) || rows.find((r) => {
    const name = String(r?.name || r?.title || r?.label || "").toLowerCase();
    return name.includes(nameNeedle);
  }) || rows[0];

  const items = found?.items || found?.proposals || found?.package?.items || [];
  const proposalIds = Array.from(new Set(items.map(proposalIdFrom).filter(Boolean)));
  return {
    id: found?.id || found?.slug || found?.name || packageName,
    label: found?.name || found?.title || found?.label || packageName,
    proposalIds,
  };
}

function lowlandScore(b, seedKey) {
  const [x, z] = b.center || [0, 0];
  const n = Math.sin(x * 0.0041 + z * 0.0057 + b.index * 0.77 + String(seedKey || "").length * 0.13) * 43758.5453;
  return n - Math.floor(n);
}

function nearestSafeHome(world, fromHomeIndex) {
  const src = world.buildings[fromHomeIndex];
  const homes = world.buildings.filter((b) => b.kind === "home" && !b.state.flooded);
  let best = null;
  let bestD = Infinity;
  for (const h of homes) {
    const d = (h.center[0] - src.center[0]) ** 2 + (h.center[1] - src.center[1]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = h;
    }
  }
  return best;
}

function applyStorm(world, severity = 1) {
  const baseFlood = 0.24 * Math.max(0.65, Math.min(1.45, severity));
  const cut = Math.max(0.04, baseFlood - Number(world.policy?.floodMitigation || 0));
  let floodedNow = 0;
  for (const b of world.buildings) {
    if (b.kind === "park") {
      b.state.flooded = false;
      continue;
    }
    b.state.flooded = lowlandScore(b, world.seedKey) < cut;
    if (b.state.flooded) floodedNow++;
  }

  let displaced = 0;
  for (const p of world.people) {
    const home = world.buildings[p.home];
    if (!home?.state?.flooded) continue;
    if (p.today) {
      p.today.homeFlooded = true;
      p.today.displaced = true;
    }
    const safe = nearestSafeHome(world, p.home);
    if (!safe) continue;
    displaced++;
    p.home = safe.index;
    p.mode = "idle";
    p.action = null;
    p.target = null;
    p.path = null;
    p.pathI = 0;
    p.x = safe.center[0] + (world.rand() - 0.5) * 4;
    p.z = safe.center[1] + (world.rand() - 0.5) * 4;
    p.doing = "displaced after storm";
    p.needs.energy = Math.max(0, p.needs.energy - 12);
    p.needs.fun = Math.max(0, p.needs.fun - 15);
    p.needs.social = Math.max(0, p.needs.social - 10);
  }

  world.policy = world.policy || {};
  world.policy.floodedNow = floodedNow;
  world.policy.displaced = displaced;
  world.log(`Storm hit: ${floodedNow} parcels flooded, ${displaced} residents displaced`, "storm");
  return { floodedNow, displaced };
}

function applyPolicyToWorld(world, policyEffects) {
  world.speedMult = policyEffects.speedMult;
  world.parkCleanupBoost = policyEffects.parkCleanupBoost;
  world.restockBoost = policyEffects.restockBoost;
  world.hiringBoost = policyEffects.hiringBoost;
  world.voucherMonthly = policyEffects.voucherMonthly;
  world.policy = {
    ...(world.policy || {}),
    ...policyEffects,
  };
}

function collectDailyJournalCandidates(world, packageLabel, year, tileKey, buildingsById) {
  const out = [];
  for (const p of world.people) {
    const sourceDay = p.yesterday || null;
    if (!sourceDay) continue;
    const probe = { ...p, today: sourceDay, walkMinutesAvg3d: Number(p.walkMinutesAvg3d || 0) };
    const text = journalFor(probe, {
      tileKey,
      buildingsById,
      policyLabel: packageLabel,
      year,
    });
    if (!text) continue;
    out.push({
      mood: ((p.needs.hunger + p.needs.energy + p.needs.fun + p.needs.social) / 4),
      hasFlood: !!(sourceDay.displaced || sourceDay.homeFlooded),
      entry: { text, author: p.name },
    });
  }
  return out;
}

function stormSeverity(seed, year) {
  const r = rng(hashSeed(`${seed}:storm:${year}`));
  return 0.8 + r() * 0.6;
}

function weekOutcomes(world, soldOutEvents, displacedResidents, litterSamples) {
  const floodedParcels = world.buildings.filter((b) => b.state?.flooded).length;
  const avgWalkMinutes = world.people.length
    ? world.people.reduce((s, p) => s + Number(p.walkMinutesAvg3d || p.today?.walkMinutes || 0), 0) / world.people.length
    : 0;
  const avgMood = Number(world.summary().mood || 0);
  const avgParkLitter = litterSamples.length
    ? litterSamples.reduce((a, b) => a + b, 0) / litterSamples.length
    : 0;
  return {
    floodedParcels,
    displacedResidents,
    avgWalkMinutes,
    avgMood,
    soldOutEvents,
    avgParkLitter,
  };
}

async function simulateYear({ town, proposalIds, year, packageLabel, seed }) {
  const simTown = cloneTown(town);
  const world = createWorld(simTown, { startMinute: 0 });
  const buildingsById = {};
  for (const b of simTown.buildings) {
    buildingsById[b.index] = b;
    buildingsById[b.id] = b;
  }

  const staged = computeEffectsForYear(proposalIds, year).effects;
  applyPolicyToWorld(world, staged);

  let soldOutEvents = 0;
  const baseLog = world.log;
  world.log = (text, kind = "info", building = null) => {
    if (kind === "soldout") soldOutEvents++;
    return baseLog(text, kind, building);
  };

  const days = 5;
  const stormDay = 2;
  let displacedResidents = 0;
  const litterSamples = [];
  const weeklyJournalCandidates = [];

  for (let d = 0; d < days; d++) {
    if (d === stormDay) {
      world.step(12 * 60);
      const storm = applyStorm(world, stormSeverity(seed, year));
      displacedResidents += storm.displaced;
      world.step(6 * 60); // to 18:00
    } else {
      world.step(18 * 60); // to 18:00
    }

    const parks = world.buildings.filter((b) => b.kind === "park");
    const litterAt18 = parks.length ? parks.reduce((s, p) => s + Number(p.state?.litter || 0), 0) / parks.length : 0;
    litterSamples.push(litterAt18);

    world.step(6 * 60); // midnight reset -> yesterday becomes available

    const dayCandidates = collectDailyJournalCandidates(world, packageLabel, year, simTown.seedKey || "tile", buildingsById);
    weeklyJournalCandidates.push(...dayCandidates);
  }

  const rankedWeek = weeklyJournalCandidates.sort((a, b) => a.mood - b.mood);
  const pickedWeek = rankedWeek.slice(0, 12);
  if (!pickedWeek.some((x) => x.hasFlood)) {
    const floodCandidate = rankedWeek.find((x) => x.hasFlood);
    if (floodCandidate && pickedWeek.length) pickedWeek[pickedWeek.length - 1] = floodCandidate;
  }
  const journals = pickedWeek.map((x) => x.entry);

  const outcomes = weekOutcomes(world, soldOutEvents, displacedResidents, litterSamples);
  return { outcomes, journals };
}

export async function runExperiment({ town, packageName, years = 10, seed = "world-exp", fetchPlan, onYear }) {
  const journalsSoFar = [];
  const plansByYear = [];

  // Baseline year 0 (no policy package selected yet).
  const baseline = await simulateYear({
    town,
    proposalIds: [],
    year: 0,
    packageLabel: "No package",
    seed,
  });
  onYear?.({ year: 0, packageName, proposalIds: [], outcomes: baseline.outcomes });
  plansByYear.push({ year: 0, proposalIds: [] });

  for (let year = 1; year <= years; year++) {
    const payload = await fetchPlan({ includeSynthetic: false, extraEntries: journalsSoFar });
    const pkg = pickPackage(payload, packageName) || { label: packageName, proposalIds: [] };

    const sim = await simulateYear({
      town,
      proposalIds: pkg.proposalIds,
      year,
      packageLabel: pkg.label,
      seed,
    });

    plansByYear.push({ year, proposalIds: pkg.proposalIds });
    for (const j of sim.journals) journalsSoFar.push(j);
    if (journalsSoFar.length > 200) journalsSoFar.splice(0, journalsSoFar.length - 200);

    onYear?.({ year, packageName, proposalIds: pkg.proposalIds, outcomes: sim.outcomes });
  }

  return { packageName, plansByYear };
}
