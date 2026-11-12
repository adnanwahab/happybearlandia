import { readPopulationCheckpoint } from '../../population/checkpoint.js';
import { compatiblePopulationContinuation } from '../../population/population-growth.js';

const SAVE_ID = /^[A-Za-z0-9_-]{8,16}$/;
const MAX_GENERATIONS = 3;
const MAX_CHECKPOINTS = 8;
const MAX_RELATIVES = 100;

export function replayURL(id) {
  return '/world?' + new URLSearchParams({ experiment: id });
}

export async function fetchCheckpoint(id, { fetcher = fetch, signal } = {}) {
  if (!SAVE_ID.test(id)) throw new Error('Enter a saved Living World ID.');
  const response = await fetcher('/api/world-experiments/' + encodeURIComponent(id), { signal });
  if (response.status === 404) throw new Error('Saved Living World checkpoint was not found.');
  if (!response.ok) throw new Error('Saved Living World checkpoint could not be read.');
  const record = await response.json();
  if (record.schemaVersion !== 'world-experiment-record.v1' || record.id !== id ||
      record.save?.schemaVersion !== 'world-experiment-save.v1' || record.save.mode !== 'living') {
    throw new Error('This record is not a saved Living World population checkpoint.');
  }
  const { model, runtime } = readPopulationCheckpoint(record.save.checkpoint);
  return {
    id,
    label: record.save.label,
    parentId: record.parentId,
    selection: record.save.view.selection,
    model,
    stepMinutes: runtime.stepMinutes,
    tick: runtime.tick,
  };
}

export function residentIndex(model, id) {
  const prefix = model.prefix + '-p';
  if (typeof id !== 'string' || !id.startsWith(prefix)) return -1;
  const index = Number(id.slice(prefix.length));
  return id === prefix + index && Number.isSafeInteger(index) && index >= 0 &&
    index < model.people.age.length ? index : -1;
}

function parentsOf(model, index) {
  return [...new Set([model.people.parent1?.[index], model.people.parent2?.[index]])]
    .filter(parent => Number.isSafeInteger(parent) && parent >= 0 &&
      parent < model.people.age.length && parent !== index);
}

function resident(model, index) {
  const { people, locations } = model;
  const id = model.prefix + '-p' + index;
  const home = locations[people.homeLocation[index]];
  const business = model.economy?.businesses?.[model.employment?.employer[index]];
  return {
    id,
    name: model.houseProfiles?.people?.[id]?.name || 'Resident ' + (index + 1),
    age: people.ageYears?.[index] ?? null,
    homeId: home?.id ?? null,
    homeLabel: home?.name || null,
    employment: people.employed[index] ? 'Employed' : people.age[index] === 0 ? 'Child' :
      people.age[index] === 2 ? 'Retired' : 'Unemployed',
    employerId: business?.id ?? null,
    employerLabel: business?.name || null,
  };
}

export function familyView(model, personId) {
  const index = residentIndex(model, personId);
  if (index < 0) throw new Error('That resident is absent from this saved checkpoint.');
  const children = new Map();
  for (let child = 0; child < model.people.age.length; child++) {
    for (const parent of parentsOf(model, child)) {
      if (!children.has(parent)) children.set(parent, []);
      children.get(parent).push(child);
    }
  }
  const lineage = new Map(model.populationLineage?.records.map(record => [record.index, record]));
  const focus = resident(model, index);
  let remaining = MAX_RELATIVES;
  let truncated = false;

  function walk(adjacent, relativeFirst) {
    const seen = new Set([index]);
    let frontier = [index];
    const levels = [];
    for (let depth = 1; depth <= MAX_GENERATIONS; depth++) {
      const next = [];
      const links = [];
      for (const source of frontier) {
        for (const relative of adjacent(source)) {
          if (seen.has(relative)) continue;
          if (remaining === 0) { truncated = true; break; }
          const child = lineage.get(relativeFirst ? source : relative);
          seen.add(relative);
          next.push(relative);
          remaining--;
          links.push({
            person: resident(model, relative),
            via: resident(model, source),
            evidence: child ? { method: child.method, minute: child.minute, id: child.id } : null,
          });
        }
      }
      if (!links.length) break;
      levels.push(links);
      frontier = next;
    }
    if (frontier.some(node => adjacent(node).some(relative => !seen.has(relative)))) truncated = true;
    return levels;
  }

  const ancestors = walk(person => parentsOf(model, person), true);
  const descendants = walk(person => children.get(person) ?? [], false);
  return { focus, ancestors, descendants, truncated };
}

export function defaultResident(checkpoint) {
  const { model, selection } = checkpoint;
  if (selection?.type === 'person' && residentIndex(model, selection.id) >= 0) return selection.id;
  const lineage = model.populationLineage?.records.at(-1);
  if (lineage) return lineage.personId;
  const withParent = model.people.parent1?.findIndex(parent => parent >= 0) ?? -1;
  return model.prefix + '-p' + Math.max(0, withParent);
}

export async function residentHistory(checkpoint, id, options = {}) {
  let current = checkpoint;
  const rows = [];
  const seen = new Set();
  let notice;
  while (current) {
    const index = residentIndex(current.model, id);
    rows.push({
      id: current.id,
      label: current.label,
      minute: current.model.minute,
      tick: current.tick,
      person: index < 0 ? null : resident(current.model, index),
    });
    seen.add(current.id);
    if (!current.parentId) break;
    if (rows.length === MAX_CHECKPOINTS) {
      notice = 'Showing up to the eight most recent saved checkpoints on this branch.';
      break;
    }
    if (seen.has(current.parentId)) {
      notice = 'An invalid parent link ended this saved history.';
      break;
    }
    let parent;
    try {
      parent = await fetchCheckpoint(current.parentId, options);
    } catch (error) {
      if (options.signal?.aborted) throw error;
      notice = 'An earlier checkpoint could not be read. ' + error.message;
      break;
    }
    if (parent.model.minute > current.model.minute || parent.stepMinutes !== current.stepMinutes ||
        !compatiblePopulationContinuation(parent.model, current.model)) {
      notice = 'An earlier checkpoint has a different population or clock. Its residents cannot be matched here.';
      break;
    }
    current = parent;
  }
  return { rows, notice };
}
