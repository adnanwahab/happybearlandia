export const KEY = 'hbl.onboarding.v1';
export const DEMO_URL = '/world/future-machine.html?demo=1';
export const EXPERIMENT = 'scenario-first.v1';
// Only consented session storage is used. Randomness never enters model inputs.
export function createHarness({ storage, random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32, now = () => Date.now(), enabled = true }) {
  let session = null;
  const save = () => storage.setItem(KEY, JSON.stringify(session));
  function withdraw() { session = null; storage.removeItem(KEY); }
  function read() {
    if (!enabled) { withdraw(); return null; }
    session = null;
    try {
      const value = JSON.parse(storage.getItem(KEY));
      if (value?.experiment === EXPERIMENT && ['direct', 'policy'].includes(value.variant) && Array.isArray(value.events)) session = value;
    } catch { withdraw(); }
    return session;
  }
  function consent() {
    if (!enabled) return null;
    if (read()) return session;
    session = { experiment: EXPERIMENT, variant: random() < .5 ? 'direct' : 'policy', events: [] };
    save(); return session;
  }
  function record(type, focus) {
    if (!session || !enabled) return;
    if (!['exposure', 'start', 'choice'].includes(type)) throw Error('Unknown onboarding event');
    if (type === 'choice' && !['homes', 'budget'].includes(focus)) throw Error('Unknown focus');
    if (session.events.some(event => event.type === type)) return;
    session.events.push({ type, at: now(), ...(type === 'choice' ? { focus } : {}) });
    save();
  }
  return { read, consent, record, withdraw };
}
