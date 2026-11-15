import { HOUSE_ACTIONS } from './model.js';
export const ROUTINE_VERSION = 'house-routine.v1';
export const ROUTINE_ACTIONS = Object.freeze(['clean', 'rest', 'read', 'music', 'cook']);
const WEEK = 10080;
// Drafts reserve one household activity at a time: shared objects and cash are
// not promised in advance. Canonical admission still decides at the due minute.
export function createRoutineDraft({ members, stepMinutes }) {
  if (!members?.length || !Number.isInteger(stepMinutes) || stepMinutes <= 0 || 1440 % stepMinutes) throw Error('An exact saved household clock is required');
  let blocks = [], history = [];
  function validate(next) {
    if (!Array.isArray(next) || next.length > 64) throw Error('At most 64 routine blocks');
    const sorted = structuredClone(next).sort((a,b) => a.offset - b.offset);
    for (const [i, block] of sorted.entries()) {
      if (!ROUTINE_ACTIONS.includes(block.type) || !members.includes(block.personId)) throw Error('Unsupported task or resident');
      const duration = HOUSE_ACTIONS[block.type].durationMinutes;
      if (!Number.isInteger(block.offset) || block.offset < 0 || block.offset % stepMinutes || duration % stepMinutes || block.offset + duration > WEEK) throw Error('Task must fit the week and saved clock');
      if (i && sorted[i-1].offset + HOUSE_ACTIONS[sorted[i-1].type].durationMinutes > block.offset) throw Error('Overlapping household tasks are rejected');
    }
    return sorted;
  }
  return {
    get blocks() { return structuredClone(blocks); },
    get canUndo() { return history.length > 0; },
    replace(next) { const checked = validate(next); history.push(blocks); blocks = checked; },
    undo() { if (history.length) blocks = history.pop(); },
    validate,
  };
}
export async function runRoutine(runtime, { checkpoint, householdId, members, runId, blocks }) {
  runtime.pause();
  const snapshot = runtime.getSnapshot();
  const draft = createRoutineDraft({ members, stepMinutes: snapshot.runtime.stepMinutes });
  const checked = draft.validate(blocks);
  await runtime.restoreCheckpoint(checkpoint); runtime.pause();
  const start = runtime.getSnapshot();
  const receipts = [];
  async function advance(target) {
    while (runtime.getSnapshot().minute < target) {
      const snap = runtime.getSnapshot(), step = snap.runtime.stepMinutes;
      const budget = Math.floor(20000000 / snap.config.population) * step;
      const minutes = Math.min(1440, budget, target - snap.minute);
      if (minutes < step) throw Error('Population exceeds observation work budget');
      const result = await runtime.observeHousehold({ householdId, minutes });
      if (result.status !== 'completed') throw Error('Routine run interrupted; rerun from pin');
    }
  }
  for (const block of checked) {
    await advance(start.minute + block.offset);
    const request = { householdId, personId: block.personId, type: block.type };
    const availability = await runtime.householdActionAvailability(request);
    if (!availability.available) { receipts.push({ block, minute: runtime.getSnapshot().minute, accepted: false, reason: availability.reason }); continue; }
    try {
      const result = await runtime.householdAction(request);
      receipts.push({ block, minute: runtime.getSnapshot().minute, accepted: true, cost: availability.cost, result });
    } catch (error) { receipts.push({ block, minute: runtime.getSnapshot().minute, accepted: false, reason: error.message }); }
  }
  await advance(start.minute + WEEK);
  return { schemaVersion: ROUTINE_VERSION, runId, householdId, members: [...members], modelVersion: start.modelVersion,
    seed: start.config.seed, config: structuredClone(start.config), startMinute: start.minute, startTick: start.runtime.tick,
    stepMinutes: start.runtime.stepMinutes, endMinute: runtime.getSnapshot().minute, endTick: runtime.getSnapshot().runtime.tick, blocks: checked, receipts, checkpoint: await runtime.exportCheckpoint(),
    household: await runtime.inspectHousehold(householdId) };
}
