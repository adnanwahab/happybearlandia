const ID = /^[A-Za-z0-9_-]{8,16}$/;

export const traits = {
  homeId: 'Home', district: 'Home district', employerId: 'Employer', employed: 'Employment', income: 'Modeled annual income',
};

export async function listLivingSaves(fetcher = fetch) {
  const response = await fetcher('/api/world-experiments');
  if (!response.ok) throw new Error('The saved World catalog could not be read.');
  const { experiments } = await response.json();
  return experiments.filter(row => row.mode === 'living' && ID.test(row.id));
}

export function firstDifference(left, right) {
  const samePrefix = left.findIndex((row, i) => row.id !== right[i]?.id);
  if (samePrefix < 1 || samePrefix >= right.length) return null;
  const uniqueMinutes = rows => {
    const map = new Map();
    for (const row of rows) map.set(row.minute, map.has(row.minute) ? null : row);
    return map;
  };
  const leftRows = uniqueMinutes(left.slice(samePrefix));
  const rightRows = uniqueMinutes(right.slice(samePrefix));
  for (const [minute, a] of leftRows) {
    const b = rightRows.get(minute);
    if (!a || !b) continue;
    const fields = Object.keys(traits).filter(key => a[key] !== null && b[key] !== null && a[key] !== b[key]);
    if (fields.length) return { minute, left: a, right: b, fields };
  }
  return null;
}
