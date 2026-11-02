import { hashSeed, rng } from "./gen.js";
import { createWorld } from "./sim.js";
import { journalFor, WALK_COMPLAINT_MINUTES } from "./journal.js";
import { computeEffectsForYear, NOT_SIMULATED, resolveRuleForProposal } from "./policy.js";
import { SIMULATION_MODEL_VERSION, SIMULATION_PARAMETERS } from "./simulation-parameters.js";
import { applyMonthlyVoucher, captureLongitudinalState, restoreLongitudinalState, scaleHouseholdCash } from "./simulation-state.js";
import { observeWorld } from "./simulation-observations.js";

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
  const proposalCosts = {};
  for (const item of items) {
    const id = proposalIdFrom(item);
    const c = Number(item?.proposal?.costB ?? item?.costB ?? item?.proposalCostB);
    if (id && Number.isFinite(c)) proposalCosts[id] = c;
  }

  return {
    id: found?.id || found?.slug || found?.name || packageName,
    label: found?.name || found?.title || found?.label || packageName,
    proposalIds,
    changesFromPrevious: found?.changesFromPrevious || null,
    challengerStreak: found?.challengerStreak || {},
    proposalCosts,
  };
}

function lowlandScore(b, seedKey) {
  const [x, z] = b.center || [0, 0];
  const phase = (hashSeed(String(seedKey || "")) % 100000) / 100000;
  const n = Math.sin(x * 0.0041 + z * 0.0057 + b.index * 0.77 + phase * Math.PI * 2) * 43758.5453;
  return n - Math.floor(n);
}

export function floodZoneBucket(zoneRaw) {
  const z = String(zoneRaw || "X").toUpperCase();
  if (z === "AE" || z === "A" || z === "VE") return 0; // 100-year
  if (z === "X500") return 1; // 500-year
  return 2; // X/other
}

function floodOrderScore(b, seedKey) {
  const bucket = floodZoneBucket(b?.floodZone);
  const tie = lowlandScore(b, seedKey);
  return bucket + tie / 10;
}

export function selectFloodedBuildingIds(buildings, seedKey, floodFraction) {
  const active = (buildings || []).filter((b) => b.kind !== "park");
  if (!active.length) return new Set();
  const frac = Math.max(0, Math.min(1, Number(floodFraction || 0)));
  const n = Math.max(0, Math.min(active.length, Math.round(active.length * frac)));
  const ranked = [...active].sort((a, b) => {
    const da = floodOrderScore(a, seedKey);
    const db = floodOrderScore(b, seedKey);
    if (da !== db) return da - db;
    return (a.index ?? 0) - (b.index ?? 0);
  });
  return new Set(ranked.slice(0, n).map((b) => b.index));
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
  const baseFlood = 0.24 * Math.max(0.5, Math.min(2.2, severity));
  const floodFraction = Math.max(0, Math.min(1, baseFlood - Number(world.policy?.floodMitigation || 0)));
  const floodedIds = selectFloodedBuildingIds(world.buildings, world.seedKey, floodFraction);

  let floodedNow = 0;
  for (const b of world.buildings) {
    if (b.kind === "park") {
      b.state.flooded = false;
      continue;
    }
    b.state.flooded = floodedIds.has(b.index);
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
  world.groceryDelivery = policyEffects.groceryDelivery || 0;
  world.policy = {
    ...(world.policy || {}),
    ...policyEffects,
  };
}

function policyContributions(proposalIds, year, adoptedYearByProposal = null) {
  const out = {};
  for (const pid of proposalIds || []) {
    const mapped = resolveRuleForProposal(pid);
    if (!mapped) continue;
    const adoptedYear = adoptedYearByProposal && Number.isFinite(adoptedYearByProposal[pid])
      ? Number(adoptedYearByProposal[pid])
      : 0;
    const yearsInEffect = year - adoptedYear;
    const p = Math.max(0, Math.min(1, (mapped.rule.rampYears <= 0)
      ? (yearsInEffect >= mapped.rule.lagYears ? 1 : 0)
      : ((yearsInEffect - mapped.rule.lagYears) / mapped.rule.rampYears)));
    out[pid] = {
      speedAdd: Number(mapped.rule.speedAdd || 0) * p,
      floodMitigationAdd: Number(mapped.rule.floodMitigationAdd || 0) * p,
    };
  }
  return out;
}

function estimateStormDisplacement(world, severity, floodMitigation) {
  const baseFlood = 0.24 * Math.max(0.5, Math.min(2.2, severity));
  const floodFraction = Math.max(0, Math.min(1, baseFlood - Number(floodMitigation || 0)));

  const flooded = selectFloodedBuildingIds(world.buildings, world.seedKey, floodFraction);

  const safeHomes = world.buildings.filter((b) => b.kind === "home" && !flooded.has(b.index));
  if (!safeHomes.length) return 0;

  let displaced = 0;
  for (const p of world.people) {
    if (flooded.has(p.home)) displaced++;
  }
  return displaced;
}

function computeRawSeverities(sim) {
  const population = Math.max(1, Number(sim.population || 1));
  const overWalkComplaint = Number(sim.outcomes?.overWalkComplaint || 0);
  const displacedResidents = Number(sim.outcomes?.displacedResidents || 0);
  const transit = Math.max(0, Math.min(1, (overWalkComplaint / population) / 0.3));
  const flooding = Math.max(0, Math.min(1, displacedResidents / (0.1 * population)));
  return { transit, flooding };
}

function movingAvg3(values) {
  const xs = values.filter((x) => Number.isFinite(x));
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function deriveSynthesisOutcomes(sim, rawSeverityHistory, impactHistory, proposalIds, adoptedYearByProposal, year) {
  const raw = computeRawSeverities(sim);

  const transitSevSeries = [...rawSeverityHistory.transit, raw.transit].slice(-3);
  const floodingSevSeries = [...rawSeverityHistory.flooding, raw.flooding].slice(-3);
  const transitSeverity = Math.max(0, Math.min(1, movingAvg3(transitSevSeries)));
  const floodingSeverity = Math.max(0, Math.min(1, movingAvg3(floodingSevSeries)));

  const items = {};
  const rawImpacts = {};

  const avgImpact = (pid, value) => {
    const hist = Array.isArray(impactHistory?.[pid]) ? impactHistory[pid] : [];
    return Math.max(0, Math.min(1, movingAvg3([...hist, value].slice(-3))));
  };

  const displacedWithAll = Number(sim.stormDiagnostics?.displacedWithAll ?? sim.outcomes?.displacedResidents ?? 0);
  for (const pid of ["f_drainage", "f_buyouts"]) {
    const displacedWithout = Number(sim.stormDiagnostics?.displacedWithoutByItem?.[pid]);
    const without = Number.isFinite(displacedWithout) ? Math.max(0, displacedWithout) : Math.max(0, displacedWithAll);
    const withIt = Math.max(0, displacedWithAll);
    const impactRaw = without > 0 ? Math.max(0, Math.min(1, (without - withIt) / without)) : 0;

    const mapped = resolveRuleForProposal(pid);
    const lag = Number(mapped?.rule?.lagYears || 0);
    const ramp = Number(mapped?.rule?.rampYears || 0);
    const adoptedYear = Number.isFinite(adoptedYearByProposal?.[pid]) ? Number(adoptedYearByProposal[pid]) : null;
    const yearsInEffect = adoptedYear === null ? 0 : year - adoptedYear;

    rawImpacts[pid] = impactRaw;
    items[pid] = { impact: avgImpact(pid, impactRaw), maturing: adoptedYear !== null && yearsInEffect < (lag + ramp) };
  }

  const population = Math.max(1, Number(sim.population || 1));
  const withTransit = Math.max(0, Math.min(population, Number(sim.outcomes?.overWalkComplaint || 0)));
  const totalSpeedAdd = Math.max(0, Number(sim.outcomes?.speedMult || 1) - 1);
  for (const pid of ["t_bus", "t_brt"]) {
    const share = totalSpeedAdd > 0
      ? Math.max(0, Math.min(1, Number(sim.policyContributionByItem?.[pid]?.speedAdd || 0) / totalSpeedAdd))
      : 0;
    const withoutTransit = Math.max(withTransit, Math.min(population, withTransit + (population - withTransit) * share));
    const impactRaw = withoutTransit > 0 ? Math.max(0, Math.min(1, (withoutTransit - withTransit) / withoutTransit)) : 0;

    const mapped = resolveRuleForProposal(pid);
    const lag = Number(mapped?.rule?.lagYears || 0);
    const ramp = Number(mapped?.rule?.rampYears || 0);
    const adoptedYear = Number.isFinite(adoptedYearByProposal?.[pid]) ? Number(adoptedYearByProposal[pid]) : null;
    const yearsInEffect = adoptedYear === null ? 0 : year - adoptedYear;

    rawImpacts[pid] = impactRaw;
    items[pid] = { impact: avgImpact(pid, impactRaw), maturing: adoptedYear !== null && yearsInEffect < (lag + ramp) };
  }

  return {
    needs: {
      transit: { severity: transitSeverity },
      flooding: { severity: floodingSeverity },
    },
    items,
    raw: { ...raw, impacts: rawImpacts },
  };
}

function collectDailyJournalCandidates(world, packageLabel, year, tileKey, buildingsById, dayIndex, yearStartMs) {
  const out = [];
  for (const p of world.people) {
    const sourceDay = p.yesterday || null;
    if (!sourceDay) continue;
    const probe = { ...p, today: sourceDay, walkMinutesAvg3d: Number(p.walkMinutesAvg3d || 0), travelMinutesAvg3d: Number(p.travelMinutesAvg3d ?? p.walkMinutesAvg3d ?? 0) };
    const text = journalFor(probe, {
      tileKey,
      buildingsById,
      policyLabel: packageLabel,
      year,
    });
    if (!text) continue;

    const floodSeverity = sourceDay.displaced ? 2 : (sourceDay.homeFlooded ? 1 : 0);
    const transitSeverity = Number(probe.travelMinutesAvg3d ?? probe.walkMinutesAvg3d ?? sourceDay.travelMinutes ?? sourceDay.walkMinutes ?? 0);
    const streetsSeverity = Number(sourceDay.dirtyParkVisits || 0);
    const soldOutCount = Array.isArray(sourceDay.soldOutAt) ? sourceDay.soldOutAt.length : 0;
    const groceriesSeverity = soldOutCount + (sourceDay.emptyFridge ? 1 : 0);
    const createdAt = new Date(yearStartMs + dayIndex * 24 * 60 * 60 * 1000 + 18 * 60 * 60 * 1000).toISOString();

    out.push({
      key: `${String(p.id ?? p.name)}:${String(sourceDay.day ?? 0)}`,
      mood: ((p.needs.hunger + p.needs.energy + p.needs.fun + p.needs.social) / 4),
      entry: { text, author: p.name, createdAt },
      severity: {
        flood: floodSeverity,
        transit: transitSeverity,
        streets: streetsSeverity,
        groceries: groceriesSeverity,
      },
    });
  }
  return out;
}

function pickWeeklyJournalsByProblem(candidates, maxTotal = 12, perProblemCap = 4) {
  const types = ["flood", "transit", "streets", "groceries"];
  const byType = {};

  for (const t of types) {
    byType[t] = candidates
      .filter((c) => Number(c?.severity?.[t] || 0) > 0)
      .sort((a, b) => (Number(b.severity[t] || 0) - Number(a.severity[t] || 0)) || (a.mood - b.mood));
  }

  const selected = [];
  const selectedPerType = Object.fromEntries(types.map((t) => [t, 0]));
  const used = new Set();

  for (let round = 0; round < perProblemCap && selected.length < maxTotal; round++) {
    for (const t of types) {
      if (selected.length >= maxTotal) break;
      if (selectedPerType[t] >= perProblemCap) continue;

      const pool = byType[t] || [];
      const next = pool.find((c) => !used.has(c.key));
      if (!next) continue;

      used.add(next.key);
      selected.push(next);
      selectedPerType[t]++;
    }
  }

  return selected.slice(0, maxTotal).map((x) => x.entry);
}

function stormSeverity(seed, year) {
  const r = rng(hashSeed(`${seed}:storm:${year}`));
  return 0.8 + r() * 0.6;
}

async function fetchReplayFloodSeverities(fetchOutcomes) {
  try {
    const payload = await fetchOutcomes();
    const rows = Array.isArray(payload?.outcomes?.series) ? payload.outcomes.series : (Array.isArray(payload?.series) ? payload.series : []);
    const flood = rows
      .filter((r) => String(r?.needId || "") === "flooding")
      .map((r) => ({ year: Number(r.year), severity: Number(r.severity) }))
      .filter((r) => Number.isFinite(r.year) && Number.isFinite(r.severity));

    if (!flood.length) throw new Error("no flooding outcomes series");

    const years = Array.from({ length: 10 }, (_, i) => 2015 + i);
    const byYear = new Map(flood.map((r) => [r.year, Math.max(0, Math.min(1, r.severity))]));
    const known = [...byYear.values()];
    const fallback = known.length ? [...known].sort((a, b) => a - b)[Math.floor(known.length / 2)] : 0.8;
    return {
      source: "real",
      series: years.map((y) => ({ year: y, severity: byYear.get(y) ?? fallback })),
    };
  } catch {
    const years = Array.from({ length: 10 }, (_, i) => 2015 + i);
    return {
      source: "simulated",
      series: years.map((y, i) => ({ year: y, severity: 0.8 + (i % 3) * 0.1 })),
    };
  }
}

function weekOutcomes(world, soldOutEvents, displacedResidents, litterSamples) {
  const floodedParcels = world.buildings.filter((b) => b.state?.flooded).length;
  const observed = observeWorld(world);
  const avgParkLitter = litterSamples.length
    ? litterSamples.reduce((a, b) => a + Number(b || 0), 0) / litterSamples.length
    : 0;
  const overWalkComplaint = world.people.filter((p) => Number(p.travelMinutesAvg3d ?? p.walkMinutesAvg3d ?? 0) > WALK_COMPLAINT_MINUTES).length;
  return {
    floodedParcels,
    displacedResidents,
    ...observed,
    soldOutEvents,
    avgParkLitter,
    overWalkComplaint,
  };
}

function classifyJournalType(text) {
  const t = String(text || "").toLowerCase();
  if (t.includes("flood") || t.includes("storm") || t.includes("drainage")) return "flood";
  if (t.includes("commute") || t.includes("bus")) return "transit";
  return "other";
}

/**
 * Scale every plan lever toward "no effect" by `scale` (plan delivery: 0 = nothing
 * delivered, 1 = as designed, >1 = better than designed).
 */
export function scalePolicyEffects(effects, scale = 1) {
  const k = Math.max(0, Number.isFinite(scale) ? scale : 1);
  if (k === 1) return effects;
  return {
    ...effects,
    speedMult: 1 + (effects.speedMult - 1) * k,
    floodMitigation: Math.min(0.45, effects.floodMitigation * k),
    housingGrowth: effects.housingGrowth * k,
    voucherMonthly: effects.voucherMonthly * k,
    parkCleanupBoost: effects.parkCleanupBoost * k,
    restockBoost: effects.restockBoost * k,
    hiringBoost: effects.hiringBoost * k,
    groceryDelivery: Math.min(1, effects.groceryDelivery * k),
  };
}

/**
 * World conditions (possible-worlds engine, futures.js). All optional; the defaults
 * leave the simulation byte-for-byte as before.
 *  moneyMult   households' cash at the start of the week
 *  wageMult    pay per hour worked
 *  restockAdd  added to shop/kitchen restock rate (supply chains; negative = shortages)
 *  cleanupAdd  added to park cleanup (civic trust, city crews)
 *  mobilityMult multiplies generalized transit service (street/service conditions)
 *  stormMult   multiplies this year's storm severity (climate)
 *  planScale   how much of the plan's designed effect is delivered
 */
export function applyConditions(world, simTown, conditions) {
  if (!conditions) return;
  const c = conditions;
  if (Number.isFinite(c.moneyMult) && c.moneyMult !== 1) scaleHouseholdCash(world, c.moneyMult);
  if (Number.isFinite(c.wageMult)) world.wageMult = Math.max(0.1, c.wageMult);
  if (Number.isFinite(c.restockAdd)) world.restockBoost = Math.max(-0.9, world.restockBoost + c.restockAdd);
  if (Number.isFinite(c.cleanupAdd)) world.parkCleanupBoost = Math.max(-0.9, world.parkCleanupBoost + c.cleanupAdd);
  if (Number.isFinite(c.mobilityMult)) world.speedMult = Math.max(0.3, world.speedMult * c.mobilityMult);
}

export async function simulateYear({ town, proposalIds, year, packageLabel, seed, adoptedYearByProposal = null, yearStartMs, stormSeverityValue = null, runSeed = null, collectPeople = false, conditions = null, initialState = null }) {
  const simTown = cloneTown(town);
  const world = createWorld(simTown, { startMinute: 0, runSeed });
  restoreLongitudinalState(world, initialState);
  const buildingsById = {};
  for (const b of simTown.buildings) {
    buildingsById[b.index] = b;
    buildingsById[b.id] = b;
  }

  const staged = scalePolicyEffects(computeEffectsForYear(proposalIds, year, adoptedYearByProposal).effects, conditions?.planScale);
  const policyContributionByItem = policyContributions(proposalIds, year, adoptedYearByProposal);
  if (Number.isFinite(conditions?.planScale) && conditions.planScale !== 1) {
    for (const v of Object.values(policyContributionByItem)) {
      v.speedAdd *= Math.max(0, conditions.planScale);
      v.floodMitigationAdd *= Math.max(0, conditions.planScale);
    }
  }
  applyPolicyToWorld(world, staged);
  applyConditions(world, simTown, conditions);
  // This annual point is a representative week, so recurring monthly support is
  // sampled once at the start of the week instead of waiting for day 30.
  if (world.voucherMonthly > 0) {
    applyMonthlyVoucher(world, world.voucherMonthly, SIMULATION_PARAMETERS.economy.lowCashPerPerson);
  }

  let soldOutEvents = 0;
  const baseLog = world.log;
  world.log = (text, kind = "info", building = null) => {
    if (kind === "soldout") soldOutEvents++;
    return baseLog(text, kind, building);
  };

  const days = SIMULATION_PARAMETERS.experiment.sampleDaysPerYear;
  const stormDay = 2;
  // Optional per-resident week summary (for "why did this happen?"). Off by default.
  const perPerson = collectPeople ? world.people.map(() => ({ walk: 0, moodSum: 0, days: 0, displaced: false, emptyFridgeDays: 0, soldOut: 0, dirtyPark: 0 })) : null;
  let displacedResidents = 0;
  const litterSamples = [];
  const weeklyJournalCandidates = [];
  let stormDiagnostics = {
    displacedNoMitigation: 0,
    displacedWithAll: 0,
    displacedWithoutByItem: {},
  };

  for (let d = 0; d < days; d++) {
    if (d === stormDay) {
      world.step(12 * 60);
      const severity = (Number.isFinite(stormSeverityValue) ? Number(stormSeverityValue) : stormSeverity(seed, year)) * (Number.isFinite(conditions?.stormMult) ? conditions.stormMult : 1);
      const totalFloodMitigation = Number(staged.floodMitigation || 0);
      const displacedNoMitigation = estimateStormDisplacement(world, severity, 0);
      const displacedWithAll = estimateStormDisplacement(world, severity, totalFloodMitigation);
      const displacedWithoutByItem = {};
      for (const pid of Object.keys(policyContributionByItem)) {
        const itemMit = Number(policyContributionByItem[pid]?.floodMitigationAdd || 0);
        if (itemMit <= 0) continue;
        displacedWithoutByItem[pid] = estimateStormDisplacement(world, severity, Math.max(0, totalFloodMitigation - itemMit));
      }
      stormDiagnostics = { displacedNoMitigation, displacedWithAll, displacedWithoutByItem };

      const storm = applyStorm(world, severity);
      displacedResidents += storm.displaced;
      world.step(6 * 60); // to 18:00
    } else {
      world.step(18 * 60); // to 18:00
    }

    const parks = world.buildings.filter((b) => b.kind === "park");
    const litterAt18 = parks.length ? parks.reduce((s, p) => s + Number(p.state?.litter || 0), 0) / parks.length : 0;
    litterSamples.push(litterAt18);

    world.step(6 * 60); // midnight reset -> yesterday becomes available

    if (perPerson) {
      world.people.forEach((p, i) => {
        const y = p.yesterday || {};
        const acc = perPerson[i];
        acc.walk += Number(y.walkMinutes || 0);
        acc.moodSum += (p.needs.hunger + p.needs.energy + p.needs.fun + p.needs.social) / 4;
        acc.days += 1;
        acc.displaced = acc.displaced || !!y.displaced;
        if (y.emptyFridge) acc.emptyFridgeDays += 1;
        acc.soldOut += Array.isArray(y.soldOutAt) ? y.soldOutAt.length : 0;
        acc.dirtyPark += Number(y.dirtyParkVisits || 0);
      });
    }

    const dayCandidates = collectDailyJournalCandidates(world, packageLabel, year, simTown.seedKey || "tile", buildingsById, d, yearStartMs);
    weeklyJournalCandidates.push(...dayCandidates);
  }

  const journals = pickWeeklyJournalsByProblem(weeklyJournalCandidates, 12, 4);

  const outcomes = {
    ...weekOutcomes(world, soldOutEvents, displacedResidents, litterSamples),
    speedMult: Number(world.speedMult || 1),
    floodMitigation: Number(world.policy?.floodMitigation || 0),
  };

  const journalCounts = { flood: 0, transit: 0 };
  for (const j of journals) {
    const kind = classifyJournalType(j?.text);
    if (kind === "flood") journalCounts.flood++;
    if (kind === "transit") journalCounts.transit++;
  }

  const people = perPerson
    ? world.people.map((p, i) => {
      const a = perPerson[i];
      return {
        id: p.id, name: p.name, age: p.age, trait: p.trait, worker: p.job != null, student: p.school != null,
        walkMinutesPerDay: a.days ? a.walk / a.days : 0,
        mood: a.days ? a.moodSum / a.days : 0,
        money: Number(p.money || 0),
        displaced: a.displaced,
        emptyFridgeDays: a.emptyFridgeDays,
        soldOutHits: a.soldOut,
        dirtyParkVisits: a.dirtyPark,
      };
    })
    : undefined;

  return {
    outcomes,
    people,
    journals,
    journalCounts,
    population: world.people.length,
    policyContributionByItem,
    stormDiagnostics,
    state: captureLongitudinalState(world),
    model: {
      version: SIMULATION_MODEL_VERSION,
      sampleDaysPerYear: days,
      longitudinal: true,
      note: "Representative annual sample; state carries forward between years.",
    },
    stormSeverity: (Number.isFinite(stormSeverityValue) ? Number(stormSeverityValue) : stormSeverity(seed, year)) * (Number.isFinite(conditions?.stormMult) ? conditions.stormMult : 1),
  };
}

function isNotSimulatedProposal(id) {
  const pid = String(id || "").toLowerCase();
  return NOT_SIMULATED.has(pid) || !resolveRuleForProposal(pid);
}

function formatNotSimulatedChanges(changesFromPrevious, costByProposalId) {
  const out = [];
  const added = Array.isArray(changesFromPrevious?.added) ? changesFromPrevious.added : [];
  const removed = Array.isArray(changesFromPrevious?.removed) ? changesFromPrevious.removed : [];

  for (const id of added) {
    if (!isNotSimulatedProposal(id)) continue;
    const c = Number(costByProposalId[id]);
    out.push(`+${id}${Number.isFinite(c) ? ` ($${c}B)` : ""}`);
  }
  for (const id of removed) {
    if (!isNotSimulatedProposal(id)) continue;
    const c = Number(costByProposalId[id]);
    out.push(`−${id}${Number.isFinite(c) ? ` ($${c}B)` : ""}`);
  }
  return out;
}

async function inferExperimentStartMs() {
  try {
    const res = await fetch("/api/dear-congress/state", { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return Date.now();
    const payload = await res.json();
    const entries = Array.isArray(payload?.entries) ? payload.entries : [];
    const times = entries
      .map((e) => Date.parse(String(e?.createdAt || "")))
      .filter((t) => Number.isFinite(t));
    if (!times.length) return Date.now();
    return Math.max(...times);
  } catch {
    return Date.now();
  }
}

export async function runExperiment({
  town,
  packageName,
  years = 10,
  seed = "world-exp",
  fetchPlan,
  onYear,
  experimentStartMs,
  mode = "synthetic",
  fetchOutcomes = async () => {
    const res = await fetch("/api/outcomes", { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`outcomes HTTP ${res.status}`);
    return await res.json();
  },
}) {
  const journalsSoFar = [];
  const plansByYear = [];
  let previousSelection = null;
  let previousChallengerStreak = null;
  let adoptedYearByProposal = {};
  const startMs = Number.isFinite(experimentStartMs) ? Number(experimentStartMs) : await inferExperimentStartMs();
  const proposalCostById = {};

  // Baseline year 0 (no policy package selected yet).
  const baseline = await simulateYear({
    town,
    proposalIds: [],
    year: 0,
    packageLabel: "No package",
    seed,
    runSeed: `${seed}:year:0`,
    yearStartMs: startMs - 365 * 24 * 60 * 60 * 1000,
  });
  let longitudinalState = baseline.state;
  const rawSeverityHistory = { transit: [], flooding: [] };
  const impactHistory = { t_bus: [], t_brt: [], f_drainage: [], f_buyouts: [] };
  let previousOutcomes = deriveSynthesisOutcomes(baseline, rawSeverityHistory, impactHistory, [], {}, 0);
  const replay = mode === "replay" ? await fetchReplayFloodSeverities(fetchOutcomes) : { source: "simulated", series: [] };
  const replaySeverities = replay.series;
  rawSeverityHistory.transit.push(Number(previousOutcomes.raw?.transit || 0));
  rawSeverityHistory.flooding.push(Number(previousOutcomes.raw?.flooding || 0));
  if (rawSeverityHistory.transit.length > 3) rawSeverityHistory.transit.shift();
  if (rawSeverityHistory.flooding.length > 3) rawSeverityHistory.flooding.shift();
  for (const pid of Object.keys(impactHistory)) {
    impactHistory[pid].push(Number(previousOutcomes.raw?.impacts?.[pid] || 0));
    if (impactHistory[pid].length > 3) impactHistory[pid].shift();
  }

  onYear?.({ year: 0, packageName, packageId: "none", proposalIds: [], changesFromPrevious: null, outcomes: baseline.outcomes, yearLabel: mode === "replay" ? "2014" : "Y0" });
  plansByYear.push({ year: 0, packageId: "none", proposalIds: [], changesFromPrevious: null, notSimulatedChanges: [] });

  const replayYears = replaySeverities.map((x) => x.year);
  const effectiveYears = mode === "replay" ? replayYears.length : years;

  for (let year = 1; year <= effectiveYears; year++) {
    const yearNowMs = startMs + (year - 1) * 365 * 24 * 60 * 60 * 1000;
    const body = {
      includeSynthetic: false,
      extraEntries: journalsSoFar,
      now: new Date(yearNowMs).toISOString(),
      outcomes: previousOutcomes,
      previous: {},
      challengerStreak: {},
    };
    if (year > 1 && previousSelection?.id) {
      body.previous = { [previousSelection.id]: previousSelection.proposalIds };
      body.challengerStreak = { [previousSelection.id]: previousChallengerStreak || {} };
    }

    const payload = await fetchPlan(body);
    const pkg = pickPackage(payload, packageName) || {
      id: packageName,
      label: packageName,
      proposalIds: [],
      changesFromPrevious: null,
      challengerStreak: {},
      proposalCosts: {},
    };

    for (const [id, cost] of Object.entries(pkg.proposalCosts || {})) {
      if (Number.isFinite(Number(cost))) proposalCostById[id] = Number(cost);
    }

    const nextAdoptedYearByProposal = {};
    for (const pid of pkg.proposalIds) {
      nextAdoptedYearByProposal[pid] = Number.isFinite(adoptedYearByProposal[pid]) ? adoptedYearByProposal[pid] : year;
    }

    const replayYear = mode === "replay" ? replaySeverities[year - 1]?.year : null;
    const replaySeverity = mode === "replay" ? replaySeverities[year - 1]?.severity : null;

    const sim = await simulateYear({
      town,
      proposalIds: pkg.proposalIds,
      year,
      packageLabel: pkg.label,
      seed,
      adoptedYearByProposal: nextAdoptedYearByProposal,
      yearStartMs: yearNowMs,
      stormSeverityValue: replaySeverity,
      runSeed: `${seed}:year:${year}`,
      initialState: longitudinalState,
    });
    longitudinalState = sim.state;

    const notSimulatedChanges = formatNotSimulatedChanges(pkg.changesFromPrevious, proposalCostById);

    plansByYear.push({
      year,
      packageId: pkg.id,
      proposalIds: pkg.proposalIds,
      changesFromPrevious: pkg.changesFromPrevious || null,
      notSimulatedChanges,
    });
    for (const j of sim.journals) journalsSoFar.push(j);
    if (journalsSoFar.length > 200) journalsSoFar.splice(0, journalsSoFar.length - 200);

    previousOutcomes = deriveSynthesisOutcomes(sim, rawSeverityHistory, impactHistory, pkg.proposalIds, nextAdoptedYearByProposal, year);
    rawSeverityHistory.transit.push(Number(previousOutcomes.raw?.transit || 0));
    rawSeverityHistory.flooding.push(Number(previousOutcomes.raw?.flooding || 0));
    if (rawSeverityHistory.transit.length > 3) rawSeverityHistory.transit.shift();
    if (rawSeverityHistory.flooding.length > 3) rawSeverityHistory.flooding.shift();
    for (const pid of Object.keys(impactHistory)) {
      impactHistory[pid].push(Number(previousOutcomes.raw?.impacts?.[pid] || 0));
      if (impactHistory[pid].length > 3) impactHistory[pid].shift();
    }

    onYear?.({
      year,
      yearLabel: mode === "replay" ? String(replayYear || (2014 + year)) : `Y${year}`,
      replay: mode === "replay",
      replayDataSource: mode === "replay" ? replay.source : null,
      stormSeverity: sim.stormSeverity,
      packageName,
      packageId: pkg.id,
      proposalIds: pkg.proposalIds,
      changesFromPrevious: pkg.changesFromPrevious || null,
      outcomes: sim.outcomes,
      journalCounts: sim.journalCounts,
      notSimulatedChanges,
      synthOutcomes: previousOutcomes,
    });

    previousSelection = { id: pkg.id, proposalIds: [...pkg.proposalIds] };
    previousChallengerStreak = { ...(pkg.challengerStreak || {}) };
    adoptedYearByProposal = nextAdoptedYearByProposal;
  }

  return { packageName, plansByYear };
}
