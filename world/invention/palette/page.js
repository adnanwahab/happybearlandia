import { DEFAULT, recipe, serialize, scene } from './recipe.js';
const root = document.querySelector('#palette');
const key = 'hbl.neighborhood-palette.v1';
let current = { ...DEFAULT };
const status = root.querySelector('[role=status]');
const controls = [...root.querySelectorAll('select')];
function render() {
  controls.forEach(control => { control.value = current[control.name]; });
  root.querySelector('#palette-after').innerHTML = scene(current);
  root.querySelector('#palette-diff').textContent = ['architecture', 'vegetation', 'lighting'].map(k => `${k}: original → ${current[k]}`).join('; ');
}
root.querySelector('#palette-before').innerHTML = scene(DEFAULT);
controls.forEach(control => control.addEventListener('change', () => {
  current = recipe({ ...current, [control.name]: control.value }); render();
  status.textContent = 'Preview updated. Save to keep this aesthetic recipe on this browser.';
}));
root.querySelector('#palette-save').onclick = () => {
  try { localStorage.setItem(key, serialize(current)); status.textContent = 'Render recipe saved on this browser.'; }
  catch { status.textContent = 'Storage unavailable. Preview still works; recipe was not saved.'; }
};
root.querySelector('#palette-reset').onclick = () => {
  current = { ...DEFAULT }; render();
  try { localStorage.removeItem(key); status.textContent = 'Original aesthetics restored; saved recipe cleared.'; }
  catch { status.textContent = 'Original aesthetics restored for this visit. Storage unavailable; saved recipe could not be cleared.'; }
};
try {
  const saved = localStorage.getItem(key);
  if (saved !== null) { current = recipe(JSON.parse(saved)); status.textContent = 'Saved render recipe reapplied.'; }
  else status.textContent = 'No saved recipe. Showing original aesthetics.';
} catch { status.textContent = 'Saved recipe unavailable or unsupported. Showing original aesthetics; choose new presets to replace it.'; }
render();
