export const KEY = 'hbl.playfulness.v1';
export const VERSION = 'playfulness.v1';
// Browser interaction observations only. Never coupled to simulation RNG or inputs.
export function createExperiment({ storage, enabled, random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32, day = () => Math.floor(Date.now() / 86400000) }) {
  let state = null, withdrawn = null;
  const save = () => storage.setItem(KEY, JSON.stringify(state));
  function clear() { state = null; storage.removeItem(KEY); }
  function read() {
    if (!enabled) { clear(); return null; }
    const raw = storage.getItem(KEY);
    if (!raw) { state = null; return null; }
    try {
      const s = JSON.parse(raw);
      if (s.version !== VERSION || !['plain','playful'].includes(s.arm) || !['day','visits','tasks','replays'].every(k => Number.isSafeInteger(s[k]) && s[k] >= 0) || s.visits < 1 || s.tasks > 1 || s.replays > 1 || s.replays > s.tasks || s.day > day()) throw Error('Invalid record');
      state = { version: VERSION, arm: s.arm, day: s.day, visits: s.visits, tasks: s.tasks, replays: s.replays };
      if (state.day < day()) { state.day = day(); state.visits++; save(); }
      return { ...state };
    } catch { clear(); return null; }
  }
  function consent() {
    if (!enabled) return null;
    if (state) return { ...state };
    state = {version: VERSION, arm: random() < .5 ? 'plain' : 'playful', day: day(), visits: 1, tasks: 0, replays: 0};
    withdrawn = null; save(); return { ...state };
  }
  function record(type) {
    if (!enabled || !read()) return;
    if (type === 'task') state.tasks = 1;
    else if (type === 'replay' && state.tasks) state.replays = 1;
    else throw Error('Complete the task before reporting a replay');
    save();
  }
  function withdraw() { withdrawn = state ? {arm:state.arm, withdrawn:1, eligible:1} : null; clear(); }
  function summary() {
    if (!state) return withdrawn ? {version:VERSION, ...withdrawn, scope:'current page only; erased on navigation'} : null;
    return {version:VERSION, arm:state.arm, eligible:1, taskCompletion:{numerator:state.tasks,denominator:1}, meaningfulReplay:{numerator:state.replays,denominator:state.tasks}, returnVisit:{numerator:Number(state.visits>1),denominator:1}, optOut:{numerator:0,denominator:1}};
  }
  return {read,consent,record,withdraw,summary};
}
