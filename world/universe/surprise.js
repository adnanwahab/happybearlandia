// Version the ordered curation: changing its order changes seed-to-choice mapping.
export const WONDER_VERSION = 'curated-wonders.1';
export const WONDERS = Object.freeze([
  Object.freeze({id:'two-futures', title:'One City, Two Futures', route:'/world/future-machine.html?renderer=canvas2d', preset:'Riverside housing · model seed 42 · 120 months'}),
  Object.freeze({id:'invention', title:'Reverse Simulator', route:'/world/invention/reverse/', preset:'Riverside policy search · model seed 2911 · 12 steps'}),
  Object.freeze({id:'breakpoints', title:'Reality Breakpoints', route:'/world/invention/breakpoints/', preset:'Riverside thresholds · model seed 2911 · 12 steps'}),
]);

// Selection seed only. Never pass it to a simulation or overwrite run context.
export function chooseWonder(seed, available = WONDERS) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) return null;
  const choices = WONDERS.filter(wonder => available.some(item => item.id === wonder.id));
  if (!choices.length) return null;
  let hash = 2166136261;
  for (const char of `${WONDER_VERSION}:${seed}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return choices[hash % choices.length];
}

export function mountSurprise(root, {available = WONDERS} = {}) {
  const form = root.querySelector('form');
  const input = root.querySelector('input');
  const status = root.querySelector('[role="status"]');
  const link = root.querySelector('[data-change-world]');
  const button = root.querySelector('button');
  root.hidden = false;
  function clear() { link.hidden = true; link.removeAttribute('href'); }
  function submit(event) {
    event.preventDefault();
    clear();
    const seed = input.value.trim() === '' ? NaN : Number(input.value);
    const choice = chooseWonder(seed, available);
    if (!choice) { status.textContent = 'No curated wonder available. Choose a whole-number selection seed from 0 to 4294967295, or use Play Demo.'; return; }
    status.textContent = `${choice.title} · Synthetic scenario · Preset: ${choice.preset}. Selection seed ${seed} · ${WONDER_VERSION}.`;
    link.href = choice.route;
    link.textContent = `Change world: ${choice.title} →`;
    link.hidden = false;
  }
  function invalidate() { clear(); status.textContent = 'Press Surprise Me to choose with this selection seed.'; }
  clear();
  if (!chooseWonder(0, available)) { button.disabled = true; status.textContent = 'Curated wonders are unavailable. Use Play Demo or browse more worlds.'; }
  form.addEventListener('submit', submit);
  input.addEventListener('input', invalidate);
  return () => { form.removeEventListener('submit', submit); input.removeEventListener('input', invalidate); };
}
