const prefix = 'hbl.learning.v1.';
const historyLimit = 12;

export function createJournal(storage) {
  const memory = new Map();
  let volatile = !storage;

  function read(key, fallback) {
    if (!volatile) {
      try {
        const raw = storage.getItem(prefix + key);
        const value = raw === null ? fallback : JSON.parse(raw);
        memory.set(key, value);
        return value;
      } catch {
        volatile = true;
      }
    }
    return memory.get(key) ?? fallback;
  }

  function write(key, value) {
    memory.set(key, value);
    if (!volatile) {
      try {
        storage.setItem(prefix + key, JSON.stringify(value));
      } catch {
        volatile = true;
      }
    }
  }

  function record(key, roundId) {
    return read(key, []).find(row => row.roundId === roundId)?.value ?? null;
  }

  function append(key, roundId, value) {
    const rows = read(key, []);
    if (rows.some(row => row.roundId === roundId)) throw new Error('This round already has a locked record.');
    write(key, [...rows.slice(1 - historyLimit), { roundId, value }]);
  }

  return {
    get volatile() { return volatile; },
    current: () => read('round', null),
    setCurrent: value => write('round', value),
    observations: roundId => {
      const row = read('observations', null);
      return row?.roundId === roundId ? row.records : null;
    },
    setObservations: (roundId, records) => write('observations', { roundId, records }),
    prediction: roundId => record('predictions', roundId),
    lockPrediction: (roundId, value) => append('predictions', roundId, value),
    outcome: roundId => record('outcomes', roundId),
    saveOutcome(roundId, value) {
      if (!record('predictions', roundId)) throw new Error('Lock a prediction before saving an outcome.');
      append('outcomes', roundId, value);
    },
    history() {
      const predictions = new Map(read('predictions', []).map(row => [row.roundId, row.value]));
      return read('outcomes', []).flatMap(({ roundId, value }) =>
        predictions.has(roundId) ? [{ prediction: predictions.get(roundId), resolution: value.resolution }] : []);
    },
  };
}
