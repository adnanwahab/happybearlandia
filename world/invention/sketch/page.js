import { POLICY_CATALOG } from '../model.js';
import { runSketch, SKETCH_VERSION, snapPoint, validateSketch } from './model.js';
const $ = id => document.getElementById(id);
let points = [], pencil = [20, 40], download;
for (const policy of POLICY_CATALOG.filter(row => row.type === 'transit')) {
  const option = document.createElement('option');
  option.value = policy.id;
  option.textContent = `${policy.label} · ${policy.cost} illustrative USD`;
  $('policy').append(option);
}
function input() {
  const policy = POLICY_CATALOG.find(row => row.id === $('policy').value);
  return { version: SKETCH_VERSION, kind: $('kind').value, points, policyId: policy.id, cost: policy.cost, seed: 2911, months: 12 };
}
function render() {
  $('line').setAttribute('points', points.map(point => point.join(',')).join(' '));
  $('vertices').replaceChildren(...points.map(([cx, cy]) => {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    for (const [key, value] of Object.entries({ cx, cy, r: 3, fill: '#184e69' })) circle.setAttribute(key, value);
    return circle;
  }));
  $('pencil').setAttribute('cx', pencil[0]); $('pencil').setAttribute('cy', pencil[1]);
  let validation;
  try { validateSketch(input()); validation = 'Supported district transit proposal. Ready to test.'; }
  catch (error) { validation = error.message; }
  $('preview').textContent = `${points.length} points · Pencil ${pencil.join(', ')} · ${validation}`;
  $('undo').disabled = !points.length;
  $('result').textContent = ''; $('status').textContent = ''; $('download').hidden = true;
  if (download) URL.revokeObjectURL(download);
}
function add() {
  if (points.length < 32 && !points.at(-1)?.every((value, axis) => value === pencil[axis])) points.push([...pencil]);
  render();
}
$('drawing').addEventListener('click', event => {
  const rect = $('drawing').getBoundingClientRect();
  pencil = snapPoint((event.clientX - rect.left) * 300 / rect.width, (event.clientY - rect.top) * 300 / rect.height); add();
});
$('drawing').addEventListener('keydown', event => {
  const moves = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] };
  if (moves[event.key]) { event.preventDefault(); pencil = snapPoint(...pencil.map((value, axis) => value + moves[event.key][axis])); render(); }
  else if (event.key === 'Enter') { event.preventDefault(); add(); }
  else if (event.key === 'Backspace') { event.preventDefault(); points.pop(); render(); }
});
$('undo').onclick = () => { points.pop(); render(); };
$('redraw').onclick = () => { points = []; render(); };
$('kind').onchange = $('policy').onchange = render;
$('run').onclick = () => {
  try {
    const result = runSketch(input());
    $('status').textContent = 'Recomputed paired synthetic futures · seed 2911 · month 2 to 14. Geometry does not alter routing.';
    $('result').textContent = `Final recorded mean commute: baseline ${result.baseline.final.meanCommuteMinutes} min (${result.baseline.final.commuteCount} trips); proposal ${result.alternative.final.meanCommuteMinutes} min (${result.alternative.final.commuteCount} trips). Cost assumption: ${result.proposal.cost} illustrative USD.\n${JSON.stringify(result.proposal, null, 2)}`;
    download = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }));
    $('download').href = download; $('download').hidden = false;
  } catch (error) { $('status').textContent = `Refused: ${error.message}`; }
};
render();
