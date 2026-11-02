// Frozen lifecycle used exclusively by housing model1.1.0.
import { validateBuildingProposal } from "./proposal-v1.1.js";

/** PROJECT RUN CONTRACT (renderer/analysis/kernel): each run.projects row is
 * {projectId,name,proposal,states:[{month,status,progress,floorsBuilt,completedUnits,
 * occupiedUnits,affordableUnits,publicCost,privateCost,totalCost,capacityUsed,
 * cumulativeCapacityUsed,expectedCompletionMonth,...}],events:[{month,year,type,
 * projectId,message,...}],uncertainty:{...}}. All months including 0 are stored.
 * progress is 0..1 construction progress (permitting remains 0). publicCost is
 * cumulative paid public subsidy, NOT total construction value. capacityUsed is
 * this month's home-equivalent construction capacity. Never infer state in views.
 * Proposed/cancelled input projects are inert; all other accepted statuses restart
 * as approved interventions at model month 0 (no imported partial-work balances).
 */
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
function projectRandom(seed, id) {
  let state = seed >>> 0;
  for (let i = 0; i < id.length; i++) state = Math.imul(state ^ id.charCodeAt(i), 16777619) >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = Math.imul(state ^ state >>> 15, state | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}
function phasePlan(duration) {
  const names = ["site_prep", "excavation", "foundation", "structure", "floors", "envelope", "interior"];
  const weights = [0.05, 0.05, 0.12, 0.18, 0.28, 0.16, 0.16];
  // Every phase gets an observable monthly state; the last phase needs a month
  // before completion as well. Short projects therefore have an eight-month floor.
  const extra = duration - 8;
  const months = weights.map((weight, index) => (index === 6 ? 2 : 1) + Math.floor(extra * weight));
  let remaining = duration - months.reduce((sum, value) => sum + value, 0);
  const order = weights.map((weight, index) => ({ index, remainder: extra * weight % 1 })).sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (let i = 0; i < remaining; i++) months[order[i % order.length].index]++;
  let end = 0;
  return names.map((name, index) => ({ name, start: end, end: end += months[index] }));
}
function phase(progress, row) {
  if (progress >= 1) return "complete";
  return row._phasePlan.find((entry) => progress * row._duration <= entry.end + 1e-8)?.name || "interior";
}
export function createBuildingLifecycle({ projects = [], seed = 42, parameters = {} } = {}) {
  if (!Array.isArray(projects) || projects.length > 64) throw new Error("Supply at most 64 building projects per scenario.");
  const ids = new Set();
  const rows = projects.map((proposal) => {
    const validation = validateBuildingProposal(proposal);
    if (!validation.valid) throw new Error(validation.errors.join(" "));
    if (ids.has(proposal.id)) throw new Error(`Duplicate building project id: ${proposal.id}`);
    ids.add(proposal.id);
    const p = validation.values;
    const random = projectRandom(seed, p.id);
    const permitDraw = random(), buildDraw = random(), overrunDraw = random(), cancellationDraw = random(), cancellationTimeDraw = random();
    const permitDelay = Math.floor(permitDraw * 5 + (parameters.resistance || 0) * 4);
    const buildDelay = Math.floor(buildDraw * 7 + Math.max(0, (parameters.interest_rate || 0) - 0.045) * 80);
    const costMultiplier = 1 + overrunDraw * 0.2 + Math.max(0, (parameters.inflation || 0) - 0.025) * 1.5;
    const cancellationRisk = clamp(0.01 + Math.max(0, (parameters.interest_rate || 0) - 0.045) + (parameters.resistance || 0) * 0.02 + (1 - (parameters.funding_delivery ?? 1)) * 0.1, 0, 0.5);
    const permitEnd = p.construction.permitMonths + permitDelay;
    const duration = Math.max(8, p.construction.buildMonths + buildDelay);
    const plan = phasePlan(duration);
    const equivalentUnits = Math.max(1, p.program.residentialUnits + (p.program.retailSqFt + p.program.officeSqFt) / 1000 + p.program.parkingSpaces * 0.1);
    const inactive = p.status === "proposed" || p.status === "cancelled";
    const initial = { month: 0, status: inactive ? p.status : "approved", progress: 0, floorsBuilt: 0, completedUnits: 0, occupiedUnits: 0, affordableUnits: 0,
      publicCost: 0, privateCost: 0, totalCost: 0, capacityUsed: 0, cumulativeCapacityUsed: 0, expectedCompletionMonth: permitEnd + duration, delayedMonths: 0 };
    const row = { projectId: p.id, name: p.name, proposal: p, states: [initial], events: [],
      uncertainty: { permitDelayMonths: permitDelay, buildDelayMonths: duration - p.construction.buildMonths, costMultiplier, cancellationRisk, synthetic: true,
        phaseMonths: plan.map((entry) => ({ phase: entry.name, months: entry.end - entry.start })) },
      _permitEnd: permitEnd, _duration: duration, _phasePlan: plan, _equivalentUnits: equivalentUnits, _inactive: inactive,
      _cancelMonth: cancellationDraw < cancellationRisk ? permitEnd + Math.max(1, Math.round(duration * (0.2 + cancellationTimeDraw * 0.5))) : Infinity,
      _completionMonth: null, _started: false, _capacityDelayReported: false };
    if (!inactive) row.events.push({ month: 0, year: 0, type: "PROJECT_APPROVED", projectId: p.id, message: `${p.name} entered the approved project pipeline.` });
    return row;
  }).sort((a, b) => a.projectId < b.projectId ? -1 : a.projectId > b.projectId ? 1 : 0);
  let lastMonth = 0;
  const addEvent = (row, month, type, message, detail = {}) => row.events.push({ month, year: month / 12, type, projectId: row.projectId, message, ...detail });
  const exposed = () => rows.map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => !key.startsWith("_"))));
  return {
    step({ month, capacity, parameters: current = parameters }) {
      if (!Number.isInteger(month) || month !== lastMonth + 1) throw new Error("Project lifecycle must advance one month at a time.");
      if (!Number.isFinite(capacity) || capacity < 0) throw new Error("Monthly project capacity must be finite and nonnegative.");
      lastMonth = month;
      let remaining = capacity;
      const delta = { capacityUsed: 0, publicCostDelta: 0, privateCostDelta: 0, completedUnitsDelta: 0, affordableUnitsDelta: 0, completedProjects: 0, events: [] };
      for (const row of rows) {
        const eventStart = row.events.length;
        const previous = row.states.at(-1);
        const state = { ...previous, month, capacityUsed: 0 };
        const p = row.proposal;
        if (row._inactive || previous.status === "cancelled") { row.states.push(state); continue; }
        if (row._completionMonth !== null) {
          const monthsOccupied = month - row._completionMonth;
          state.occupiedUnits = Math.min(p.program.residentialUnits, Math.floor(p.program.residentialUnits * monthsOccupied / 6));
          state.status = state.occupiedUnits >= p.program.residentialUnits ? "occupied" : "complete";
          if (monthsOccupied === 1) addEvent(row, month, "OCCUPANCY_STARTED", `${p.name} started occupancy.`);
          row.states.push(state);
          delta.events.push(...row.events.slice(eventStart));
          continue;
        }
        if (month >= row._cancelMonth) {
          state.status = "cancelled";
          addEvent(row, month, "PROJECT_CANCELLED", `${p.name} cancelled under the seeded financing/delivery risk assumption.`, { sunkPublicCost: state.publicCost });
          row.states.push(state); delta.events.push(...row.events.slice(eventStart)); continue;
        }
        if (month <= row._permitEnd) {
          state.status = "permitting";
          if (month === 1 && row.uncertainty.permitDelayMonths > 0) addEvent(row, month, "PROJECT_DELAYED", `${p.name} permit process includes ${row.uncertainty.permitDelayMonths} additional months.`, { cause: "permit-delay", months: row.uncertainty.permitDelayMonths });
          row.states.push(state); delta.events.push(...row.events.slice(eventStart)); continue;
        }
        if (!row._started) {
          row._started = true;
          addEvent(row, month, "PERMIT_GRANTED", `${p.name} received its permit.`);
          addEvent(row, month, "CONSTRUCTION_STARTED", `${p.name} entered site preparation.`);
          addEvent(row, month, "COST_OVERRUN", `${p.name} estimated construction cost changed by ${((row.uncertainty.costMultiplier - 1) * 100).toFixed(1)}%.`, { multiplier: row.uncertainty.costMultiplier, publicSubsidyCapped: true });
          if (row.uncertainty.buildDelayMonths) addEvent(row, month, "PROJECT_DELAYED", `${p.name} has ${row.uncertainty.buildDelayMonths} seeded construction-delay months.`, { cause: "construction-delay", months: row.uncertainty.buildDelayMonths });
        }
        const requested = Math.min(row._equivalentUnits / row._duration, row._equivalentUnits * (1 - previous.progress));
        const allocated = Math.min(remaining, requested);
        remaining -= allocated;
        const advancement = allocated / row._equivalentUnits;
        state.progress = clamp(previous.progress + advancement, 0, 1);
        if (1 - state.progress < 1e-10) state.progress = 1;
        state.capacityUsed = allocated;
        state.cumulativeCapacityUsed += allocated;
        state.status = phase(state.progress, row);
        const foundationEnd = row._phasePlan[2].end / row._duration;
        const structureEnd = row._phasePlan[4].end / row._duration;
        state.floorsBuilt = Math.min(p.geometry.floors, Math.floor(clamp((state.progress - foundationEnd) / (structureEnd - foundationEnd), 0, 1) * p.geometry.floors + 1e-8));
        state.totalCost = p.finance.estimatedCost * row.uncertainty.costMultiplier * state.progress;
        // Fixed public award: private owners absorb overruns; undelivered subsidy
        // cannot be spent. Already-paid costs are never reversed by later shocks.
        const publicIncrement = Math.min(p.finance.publicSubsidy - previous.publicCost,
          p.finance.publicSubsidy * (current.funding_delivery ?? 1) * advancement);
        state.publicCost = previous.publicCost + Math.max(0, publicIncrement);
        state.privateCost = Math.max(0, state.totalCost - state.publicCost);
        delta.publicCostDelta += state.publicCost - previous.publicCost;
        delta.privateCostDelta += state.privateCost - previous.privateCost;
        delta.capacityUsed += allocated;
        if (allocated + 1e-9 < requested) {
          state.delayedMonths++;
          state.expectedCompletionMonth++;
          if (!row._capacityDelayReported) { row._capacityDelayReported = true; addEvent(row, month, "PROJECT_DELAYED", `${p.name} delayed by shared construction capacity.`, { cause: "capacity-shortage" }); }
        }
        if (previous.progress + 1e-10 < foundationEnd && state.progress + 1e-10 >= foundationEnd) addEvent(row, month, "FOUNDATION_COMPLETE", `${p.name} completed its foundation.`);
        if (previous.floorsBuilt < p.geometry.floors && state.floorsBuilt === p.geometry.floors) addEvent(row, month, "STRUCTURE_TOPPED_OUT", `${p.name} reached floor ${p.geometry.floors}.`);
        if (state.progress === 1) {
          state.status = "complete";
          state.completedUnits = p.program.residentialUnits;
          state.affordableUnits = p.program.affordableUnits;
          state.floorsBuilt = p.geometry.floors;
          row._completionMonth = month;
          state.expectedCompletionMonth = month;
          delta.completedUnitsDelta += p.program.residentialUnits;
          delta.affordableUnitsDelta += p.program.affordableUnits;
          delta.completedProjects++;
          addEvent(row, month, "PROJECT_COMPLETED", `${p.name} delivered ${p.program.residentialUnits} homes.`, { homes: p.program.residentialUnits, publicCost: state.publicCost });
        }
        row.states.push(state);
        delta.events.push(...row.events.slice(eventStart));
      }
      return delta;
    },
    getProjects: exposed,
    getMetrics() {
      const states = rows.map((row) => row.states.at(-1));
      return { completedUnits: states.reduce((sum, state) => sum + state.completedUnits, 0), occupiedUnits: states.reduce((sum, state) => sum + state.occupiedUnits, 0),
        affordableUnits: states.reduce((sum, state) => sum + state.affordableUnits, 0), publicCost: states.reduce((sum, state) => sum + state.publicCost, 0),
        privateCost: states.reduce((sum, state) => sum + state.privateCost, 0), capacityUsed: states.reduce((sum, state) => sum + state.cumulativeCapacityUsed, 0),
        pipelineUnits: rows.reduce((sum, row) => sum + (!["proposed", "cancelled", "complete", "occupied"].includes(row.states.at(-1).status) ? row.proposal.program.residentialUnits : 0), 0),
        completedProjects: rows.filter((row) => row._completionMonth !== null).length, cancelledProjects: states.filter((state) => state.status === "cancelled").length };
    },
  };
}
