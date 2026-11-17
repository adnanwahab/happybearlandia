import { buildings, compileStorm, normalizeStorm, STORM_VERSION } from './scenario.js';
import { simulateWater, WATER_MODEL_VERSION } from './physics.js';
import { consequences } from './compare.js';
import { IMPACT_VERSION } from './impacts.js';

export function immutable(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(immutable);
    Object.freeze(value);
  }
  return value;
}
export const COMMANDER_VERSION = 'storm-commander.v1';
export const SOURCE = immutable({ version: COMMANDER_VERSION, source: 'authored synthetic storm-neighborhood.v1',
  recipe: normalizeStorm({ seed: 2911, rainRate: 0.0012, steps: 60 }), budget: 960000, shifts: 4 });
export const BLOCKS = immutable([
  { id: 'center-homes', name: 'Center Apartments', cells: [398, 399] },
  { id: 'east-homes', name: 'River Court', cells: [438, 439] },
  { id: 'south-homes', name: 'South Flats', cells: [790, 791] },
]);
export const DEMO = immutable(['express', 'express', 'standard']);

// Authored preparation game: one crew, ordered jobs, no physical-duration claim.
export function schedule(plan) {
  if (!Array.isArray(plan) || plan.length !== 3 || plan.some(x => !['skip', 'standard', 'express'].includes(x))) {
    throw new Error('Choose skip, standard or express for each of the three blocks.');
  }
  let cost = 0, shift = 0;
  const jobs = plan.map((mode, index) => {
    cost += mode === 'skip' ? 0 : mode === 'express' ? 360000 : 240000;
    shift += mode === 'skip' ? 0 : mode === 'express' ? 1 : 2;
    return { block: BLOCKS[index].id, mode, completedShift: shift, installed: mode !== 'skip' && shift <= SOURCE.shifts };
  });
  if (cost > SOURCE.budget) throw new Error('Plan exceeds the 960,000 illustrative USD budget.');
  return immutable({ cost, jobs, edits: jobs.flatMap((job, index) => job.installed ?
    BLOCKS[index].cells.map(cell => ({ type: 'drain', cell })) : []) });
}

function checkpoint(water) {
  if (water?.modelVersion !== WATER_MODEL_VERSION || water.size !== 32 || water.frames?.length !== 61 ||
      water.frames.some(frame => frame?.length !== 1024 || Array.from(frame).some(x => !Number.isFinite(x) || x < 0))) {
    throw new Error('No source data: complete finite storm frames are required.');
  }
  const impact = consequences(water);
  const parcels = BLOCKS.map(block => {
    const row = impact.buildings.find(x => x.id === block.id);
    if (!row || row.unknownExposureTicks) throw new Error('No source data for a monitored parcel.');
    return { id: row.id, floodedTicks: row.floodedTicks, peakDepth: row.peakDepth };
  });
  return { parcels, depths: water.frames.map(frame => BLOCKS.map(block => {
    // Existing building footprints, not drainage-installation cells.
    const footprint = buildings.find(building => building.id === block.id).cells;
    return Math.max(...footprint.map(cell => frame[cell]));
  })) };
}

export async function runCommander(plan, { source = SOURCE, signal = undefined, solver = simulateWater,
  yieldControl = () => new Promise(resolve => setTimeout(resolve, 0)) } = {}) {
  const check = () => { if (signal?.aborted) throw new Error('Cancelled. No result scored.'); };
  check();
  if (JSON.stringify(source) !== JSON.stringify(SOURCE)) throw new Error('No source data: pinned scenario unavailable or mismatched.');
  const dispatch = schedule(plan);
  await yieldControl(); check();
  const baseline = checkpoint(await solver(compileStorm(source.recipe)));
  await yieldControl(); check();
  const adjusted = checkpoint(await solver(compileStorm({ ...source.recipe, edits: dispatch.edits })));
  check();
  const protectedBlocks = adjusted.parcels.filter(row => row.floodedTicks === 0).length;
  return immutable({ version: COMMANDER_VERSION, stormVersion: STORM_VERSION, modelVersion: WATER_MODEL_VERSION,
    impactVersion: IMPACT_VERSION, source: structuredClone(SOURCE), plan: [...plan], dispatch,
    baseline, adjusted, protectedBlocks, success: protectedBlocks === 3 });
}

export async function replayCommander(record, options = {}) {
  if (record?.version !== COMMANDER_VERSION) throw new Error('Replay mismatch: unsupported checkpoint.');
  const replay = await runCommander(record.plan, options);
  if (JSON.stringify(replay) !== JSON.stringify(record)) throw new Error('Replay mismatch: recorded evidence differs. No result scored.');
  return replay;
}
