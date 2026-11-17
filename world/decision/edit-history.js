// Draft-only snapshots: never pass run results, receipts or replay state here.
export function createEditHistory(initial, { limit = 100 } = {}) {
  let sequence = 0, cursor = 0;
  let entries = [{ revision: sequence, value: structuredClone(initial) }];
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  return {
    get revision() { return entries[cursor].revision; },
    get canUndo() { return cursor > 0; },
    get canRedo() { return cursor < entries.length - 1; },
    record(value) {
      if (same(entries[cursor].value, value)) return false;
      entries = entries.slice(0, cursor + 1);
      entries.push({ revision: ++sequence, value: structuredClone(value) });
      if (entries.length > limit + 1) entries.shift();
      cursor = entries.length - 1;
      return true;
    },
    undo() { if (cursor === 0) return null; return structuredClone(entries[--cursor].value); },
    redo() { if (cursor === entries.length - 1) return null; return structuredClone(entries[++cursor].value); },
    reset(value, revision) { sequence = Math.max(sequence + 1, Number.isSafeInteger(revision) ? revision : 0); entries = [{ revision: sequence, value: structuredClone(value) }]; cursor = 0; },
  };
}
