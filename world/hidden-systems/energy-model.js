// Independent stock/flow toy. All quantities are integer energy units per wave.
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
export const ENERGY_DEMO = freeze({
  id: 'energy-neighborhood-1', model: 'energy-toy-1', rules: 'dispatch-1', seed: 706,
  source: { kind: 'synthetic authored fixture', observations: null, version: 'energy-neighborhood-1' },
  capacity: 6, batteryCapacity: 4, initialBattery: 2,
  waves: [{ id: 'morning', demand: 4 }, { id: 'evening', demand: 8 }, { id: 'night', demand: 6 }],
});
export function startEnergy(source) {
  if (source == null) throw new Error('No source data. Load the authored demo explicitly.');
  if (JSON.stringify(source) !== JSON.stringify(ENERGY_DEMO)) throw new Error('Unsupported source or model version.');
  return freeze({ source: structuredClone(source), status: 'playing', battery: source.initialBattery, actions: [], checkpoints: [] });
}
export function dispatchEnergy(run, generation) {
  if (run.status !== 'playing') throw new Error('Run is closed. Restart to try again.');
  if (!Number.isInteger(generation) || generation < 0 || generation > run.source.capacity) throw new Error('Generation must be an integer from 0 to 6.');
  const wave = run.source.waves[run.actions.length];
  // Lossless battery; generation serves demand first, surplus charges then spills.
  const discharge = Math.min(run.battery, Math.max(0, wave.demand - generation));
  const served = Math.min(wave.demand, generation + discharge);
  const charge = Math.min(run.source.batteryCapacity - run.battery, Math.max(0, generation - wave.demand));
  const spill = generation - (served - discharge) - charge;
  const battery = run.battery + charge - discharge;
  const unmet = wave.demand - served;
  const step = run.actions.length + 1;
  const checkpoint = { id: `${run.source.id}:${step}`, parent: run.checkpoints.at(-1)?.id ?? `${run.source.id}:0`,
    wave: wave.id, step, openingBattery: run.battery, generation, demand: wave.demand, served, unmet, charge, discharge, spill, battery };
  if (run.battery + generation !== battery + served + spill) throw new Error('Energy conservation failed.');
  return freeze({ ...run, battery, actions: [...run.actions, generation], checkpoints: [...run.checkpoints, checkpoint],
    status: unmet ? 'failed' : step === 3 ? 'success' : 'playing' });
}
export function cancelEnergy(run) {
  return run.status === 'playing' ? freeze({ ...run, status: 'cancelled' }) : run;
}
export function verifyEnergy(run) {
  try {
    let replay = startEnergy(run.source);
    if (!Array.isArray(run.actions) || run.actions.length > 3) return false;
    for (const action of run.actions) replay = dispatchEnergy(replay, action);
    if (run.status === 'cancelled') replay = cancelEnergy(replay);
    return JSON.stringify(replay) === JSON.stringify(run);
  } catch { return false; }
}
