export const PIN = "775ab00f67db084e7c4f322c1379f1f35879c6917dc8e6889b3e659beea05a71";
export const KEY = 'hbl.neighborhood-hunt.v1';
export const CLUES = Object.freeze([
  ['housing', 'Find why a household could move. Inspect the housing allocation decision.'],
  ['transit', 'Find what closed a transit link. Inspect its recorded inputs and outputs.'],
  ['flood', 'Find the recorded flood damage. Inspect the affected district and units.'],
  ['business', 'Find why a business has negative viability. Inspect its recorded demand and cost (viability = demand − cost).'],
  ['households', 'Find a resident’s monthly consequences. Inspect the household-linked resident record.'],
]);
export async function readArchive(text) {
  if (typeof text !== 'string' || text.length > 500000) throw Error('No source data: archive unavailable or too large.');
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  const digest = Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2,'0')).join('');
  if (digest !== PIN) throw Error('Replay mismatch: pinned archive differs. No clues credited.');
  const archive = JSON.parse(text);
  if (archive.version !== 'neighborhood-hunt.v1' || archive.stops.length !== 5) throw Error('Unsupported archive.');
  return archive;
}
export function recordAt(archive, stop) {
  if (!stop || !/^\/steps\/\d+\/(decisions|causalRecords|events|resolutions|state\/businesses)\/\d+$/.test(stop.pointer)) return null;
  return stop.pointer.slice(1).split('/').reduce((value, key) => value?.[key], archive) ?? null;
}
export function createHunt(archive, storage) {
  let visited = [], notice = '';
  try {
    const saved = JSON.parse(storage?.getItem(KEY) ?? 'null');
    if (saved?.pin === PIN && Array.isArray(saved.visited)) {
      // Only an exact ordered prefix can resume; progress is local, never a trusted score.
      for (let i=0;i<5;i++) {
        if (saved.visited[i] !== CLUES[i][0] || !recordAt(archive, archive.stops[i])) break;
        visited.push(saved.visited[i]);
      }
    } else if (saved) notice = 'Saved progress belongs to another archive; starting this route at zero.';
  } catch { notice = 'Local progress unavailable; this session still works.'; }
  function persist() {
    try { storage?.setItem(KEY, JSON.stringify({pin:PIN,visited})); }
    catch { notice = 'Local storage unavailable; progress will not survive reload.'; }
  }
  return {
    get visited() { return [...visited]; },
    get notice() { return notice; },
    open(index) {
      if (!Number.isInteger(index) || index<0 || index>=5 || index>visited.length) throw Error('Inspect the preceding clue first.');
      const stop=archive.stops[index], record=recordAt(archive,stop);
      if (stop?.id !== CLUES[index][0] || !record) throw Error('No source data for this clue. No credit.');
      // Caller displays this record before acknowledging it through inspected().
      return {stop:structuredClone(stop), record:structuredClone(record)};
    },
    inspected(index, displayed) {
      const source=this.open(index);
      if (JSON.stringify(source) !== JSON.stringify(displayed)) throw Error('Inspector record mismatch. No credit.');
      if (index===visited.length) { visited.push(CLUES[index][0]); persist(); }
    },
    reset() { visited=[]; persist(); },
  };
}
