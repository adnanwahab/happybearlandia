import { compatiblePopulationContinuation } from '../population/population-growth.js';
import { readPopulationCheckpoint } from '../population/checkpoint.js';

const prefix = 'hbl-private-remix:';
export function readPrivateRemix(id, storage = globalThis.localStorage) {
  if (!id.startsWith('remix_')) return null;
  const text = storage.getItem(prefix + id);
  if (!text) throw new Error('Private remix is unavailable in this browser.');
  return JSON.parse(text);
}

// Credit is derived from the source record, never from editable form text.
export async function savePrivateRemix(source, person, rainIntensity, result, options = {}, storage = globalThis.localStorage) {
  if ((options.visibility ?? 'private') !== 'private') throw new Error('Public remixes require ownership and access controls; publishing is unavailable.');
  const summary = options.summary?.trim();
  if (!summary || summary.length > 280) throw new Error('Describe your change in 1–280 characters.');
  if (!Number.isFinite(rainIntensity) || rainIntensity < 0 || rainIntensity > 1) throw new Error('Choose rain intensity from 0 to 1.');
  const parent = readPopulationCheckpoint(source.record.save.checkpoint);
  const child = readPopulationCheckpoint(result.changed.checkpoint);
  if (!compatiblePopulationContinuation(parent.model, child.model) || child.runtime.stepMinutes !== parent.runtime.stepMinutes || child.runtime.tick !== parent.runtime.tick + 1 || result.changed.summary.person !== person) throw new Error('Remix continuation does not match its parent.');
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(source.record.save.checkpoint)))), b => b.toString(16).padStart(2, '0')).join('');
  const id = 'remix_' + crypto.randomUUID().replaceAll('-', '').slice(0, 10);
  const record = structuredClone(source.record);
  record.id = id;
  record.parentId = source.record.id;
  record.save.parentId = source.record.id;
  record.save.label = 'Remix · ' + source.record.save.label.slice(0, 145);
  record.save.checkpoint = structuredClone(result.changed.checkpoint);
  record.save.view = { ...record.save.view, playback: {paused: true, speed: 1}, selection: {type: 'person', id: person},
    journeyFork: {version: 'population-rain-fork.v1', rainIntensity, control: result.control.summary, changed: result.changed.summary, sourceTick: parent.runtime.tick, targetTick: child.runtime.tick},
    remix: {version: 'population-remix.v1', visibility: 'private', summary,
      credit: structuredClone(source.record.save.view.remix?.credit ?? {id: source.record.id, label: source.record.save.label}),
      recipe: {version: 'population-rain-fork.v1', parentId: source.record.id, checkpointVersion: source.record.save.checkpoint.schemaVersion,
        modelVersion: parent.model.modelVersion, seed: parent.model.config.seed, sourceTick: parent.runtime.tick, stepMinutes: parent.runtime.stepMinutes,
        checkpointDigest: digest, checkpoint: structuredClone(source.record.save.checkpoint), person, rainIntensity}}};
  delete record.save.view.houseMode;
  // One new key; neither the source nor its storage entry is overwritten.
  try { storage.setItem(prefix + id, JSON.stringify(record)); }
  catch { throw new Error('Private browser storage is unavailable or full. Remix was not saved; the source is unchanged.'); }
  return {record};
}
