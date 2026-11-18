export const domains = ['buildings', 'businesses', 'households'];

export function replayMonths(replay) {
  const months = new Map();
  if (!Array.isArray(replay?.steps)) throw new Error('The replay did not return monthly states.');
  for (const { state } of replay.steps) {
    const month = state?.month;
    if (!Number.isSafeInteger(month) || month < 0 || months.has(month)) {
      throw new Error('The replay contains invalid or duplicate months.');
    }
    months.set(month, state);
  }
  return new Map([...months].sort(([a], [b]) => a - b));
}

function indexById(rows) {
  if (!Array.isArray(rows)) return null;
  const index = new Map();
  for (const row of rows) {
    if (typeof row?.id !== 'string' || !row.id || index.has(row.id)) return null;
    index.set(row.id, row);
  }
  return index;
}

function equal(left, right) {
  if (left === right) return true;
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length &&
    keys.every(key => Object.hasOwn(right, key) && equal(left[key], right[key]));
}

export function compareMonths(months, beforeMonth, afterMonth) {
  if (!months.has(beforeMonth) || !months.has(afterMonth)) {
    throw new Error('Choose two available months from the loaded run.');
  }
  return Object.fromEntries(domains.map(domain => {
    const before = indexById(months.get(beforeMonth)[domain]);
    const after = indexById(months.get(afterMonth)[domain]);
    if (!before || !after) {
      return [domain, { unavailableMonths: [...new Set([
        ...(!before ? [beforeMonth] : []), ...(!after ? [afterMonth] : []),
      ])] }];
    }

    const rows = [];
    const counts = { added: 0, removed: 0, changed: 0 };
    const ids = [...new Set([...before.keys(), ...after.keys()])].sort();
    for (const id of ids) {
      const previous = before.get(id);
      const current = after.get(id);
      const keys = [...new Set([...Object.keys(previous ?? {}), ...Object.keys(current ?? {})])].sort();
      const fields = keys.filter(key => key !== 'id' && !equal(previous?.[key], current?.[key]));
      if (previous && current && !fields.length) continue;
      const kind = !previous ? 'added' : !current ? 'removed' : 'changed';
      counts[kind]++;
      rows.push({ id, kind, fields, before: previous, after: current });
    }
    return [domain, { rows, counts }];
  }));
}
