import { defaultResident, fetchCheckpoint, residentIndex } from '../civilization/families/history.js';
import { compatiblePopulationContinuation } from '../population/population-growth.js';

import { listLivingSaves } from './comparison.js';

const MAX_BRANCHES = 10;
const MAX_CHECKPOINTS = 24;
const MAX_DEPTH = 8;

function point(checkpoint, personId) {
  const { model, id, label, tick } = checkpoint;
  const index = residentIndex(model, personId);
  if (index < 0) throw new Error('The selected resident is absent from this checkpoint.');
  const { people } = model;
  const home = model.locations[people.homeLocation[index]];
  const employer = model.economy?.businesses?.[model.employment?.employer[index]];
  return {
    id, label, tick, minute: model.minute, personId,
    householdId: model.prefix + '-h' + people.household[index],
    homeId: home?.id ?? null, home: home?.name ?? home?.id ?? null,
    district: model.districts[people.home[index]]?.id ?? null, employerId: employer?.id ?? null,
    employer: employer?.name ?? employer?.id ?? null, employed: Boolean(people.employed[index]),
    income: Number.isFinite(people.income[index]) ? people.income[index] : null,
  };
}

export async function loadBraids({ rootId, personId, fetcher = fetch }) {
  const catalog = await listLivingSaves(fetcher);
  const children = new Map();
  for (const row of catalog) {
    if (!children.has(row.parentId)) children.set(row.parentId, []);
    children.get(row.parentId).push(row);
  }
  for (const rows of children.values()) rows.sort((a, b) => a.id.localeCompare(b.id));
  const root = await fetchCheckpoint(rootId, { fetcher });
  const selected = personId || defaultResident(root);
  const branches = [];
  const notices = [];
  const seen = new Set([root.id]);
  let attempts = 1;
  let truncated = false;

  async function visit(parent, path) {
    let extended = false;
    const descendants = children.get(parent.id) ?? [];
    for (const row of descendants) {
      if (branches.length >= MAX_BRANCHES || attempts >= MAX_CHECKPOINTS || path.length >= MAX_DEPTH) {
        truncated = true;
        break;
      }
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      attempts++;
      let next, item;
      try {
        next = await fetchCheckpoint(row.id, { fetcher });
        if (next.parentId !== parent.id || next.tick < parent.tick || next.model.minute < parent.model.minute ||
            next.stepMinutes !== parent.stepMinutes || !compatiblePopulationContinuation(parent.model, next.model)) {
          throw new Error('Population or clock continuity could not be verified.');
        }
        item = point(next, selected);
      } catch (error) {
        notices.push(`${row.label ?? row.id} · ${error.message}`);
        continue;
      }
      extended = true;
      await visit(next, [...path, item]);
    }
    if (!extended && branches.length < MAX_BRANCHES) branches.push(path);
  }

  await visit(root, [point(root, selected)]);
  return { rootId, personId: selected, branches, notices, truncated };
}

