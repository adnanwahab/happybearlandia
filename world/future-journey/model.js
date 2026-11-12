import { createPopulationRuntime } from '../population/runtime.js';
import { inspectHousehold, inspectPerson, restorePopulation } from '../population/model.js';
import { readPopulationCheckpoint } from '../population/checkpoint.js';
import { compatiblePopulationContinuation } from '../population/population-growth.js';
import { defaultResident, residentIndex } from '../civilization/families/history.js';
import { persistCityReturn } from '../house/bridge.js';

export async function readFuture(id, fetcher = fetch) {
  if (!/^[A-Za-z0-9_-]{8,16}$/.test(id)) throw new Error('Invalid saved experiment ID.');
  const response = await fetcher('/api/world-experiments/' + encodeURIComponent(id));
  if (!response.ok) throw new Error(response.status === 404 ? 'Saved checkpoint is missing.' : 'Saved checkpoint could not be loaded.');
  const record = await response.json();
  if (record.id !== id || record.schemaVersion !== 'world-experiment-record.v1' || record.save?.mode !== 'living') {
    throw new Error('This checkpoint uses a different simulation model.');
  }
  const state = readPopulationCheckpoint(record.save.checkpoint);
  return { record, state };
}

export function inspectFuture({ record, state }, personId) {
  const { model, runtime } = state;
  const person = personId || defaultResident({ model, selection: record.save.view.selection });
  const index = residentIndex(model, person);
  if (index < 0) throw new Error('That resident is absent from this checkpoint.');
  const household = model.prefix + '-h' + model.people.household[index];
  const restored = restorePopulation(model);
  const resident = inspectPerson(restored, person, { track: false });
  const home = inspectHousehold(restored, household);
  return {
    experiment: record.id, person, household, tick: runtime.tick, minute: model.minute,
    modelVersion: model.modelVersion, name: resident.name ?? person, activity: resident.currentActivity,
    income: resident.income, rent: home.rent, savings: home.savings,
    homeId: resident.homeId, commute: resident.commuteMinutes,
  };
}

export async function checkpointLineage(tip, fetcher = fetch) {
  const checkpoints = [tip];
  const seen = new Set([tip.record.id]);
  let notice = '';
  let current = tip;
  while (current.record.parentId && checkpoints.length < 8) {
    try {
      const id = current.record.parentId;
      if (seen.has(id)) throw new Error('Repeated checkpoint in lineage.');
      const parent = await readFuture(id, fetcher);
      if (parent.state.runtime.tick > current.state.runtime.tick ||
          parent.state.model.minute > current.state.model.minute ||
          parent.state.runtime.stepMinutes !== current.state.runtime.stepMinutes ||
          !compatiblePopulationContinuation(parent.state.model, current.state.model)) {
        throw new Error('An earlier save uses a different population or clock.');
      }
      checkpoints.unshift(parent);
      seen.add(id);
      current = parent;
    } catch (error) {
      notice = error.message;
      break;
    }
  }
  if (!notice && current.record.parentId) notice = 'Showing the eight most recent compatible checkpoints.';
  return { checkpoints, notice };
}

export async function compareRainFork(source, person, rainIntensity, runtimeFactory = createPopulationRuntime) {
  if (!Number.isFinite(rainIntensity) || rainIntensity < 0 || rainIntensity > 1) throw new Error('Choose rain intensity from 0 to 1.');
  const expected = inspectFuture(source, person);
  async function run(edit) {
    const runtime = runtimeFactory();
    try {
      await runtime.ready;
      await runtime.restoreCheckpoint(source.record.save.checkpoint);
      runtime.pause();
      if (edit) await runtime.configureWeather({ rainIntensity });
      await runtime.step();
      const checkpoint = await runtime.exportCheckpoint();
      const state = readPopulationCheckpoint(checkpoint);
      if (state.runtime.tick !== expected.tick + 1 ||
          !compatiblePopulationContinuation(source.state.model, state.model)) {
        throw new Error('Continuation did not preserve the checkpoint population and clock.');
      }
      return { checkpoint, summary: inspectFuture({ record: source.record, state }, person), weather: runtime.getWeatherSnapshot() };
    } finally {
      runtime.destroy();
    }
  }
  return { control: await run(false), changed: await run(true) };
}

export async function saveRainFork(source, person, rainIntensity, result, fetchImpl = fetch) {
  return persistCityReturn({
    save: { ...source.record.save, label: 'Rain fork · ' + source.record.save.label.slice(0, 145) },
    checkpoint: result.changed.checkpoint, parentId: source.record.id, fetchImpl,
    viewPatch: {
      playback: { paused: true, speed: 1 }, selection: { type: 'person', id: person },
      journeyFork: {
        version: 'population-rain-fork.v1', rainIntensity,
        control: result.control.summary, changed: result.changed.summary,
        sourceTick: source.state.runtime.tick, targetTick: result.changed.summary.tick,
      },
    },
  });
}
