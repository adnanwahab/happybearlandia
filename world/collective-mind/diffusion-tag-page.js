import { createDiffusionTag } from './diffusion-tag.js';
const host = document.getElementById('diffusion-tag');
const status = host.querySelector('[role=status]');
const choices = host.querySelector('fieldset');
const graph = host.querySelector('svg');
const reveal = host.querySelector('[data-reveal]');
const cancel = host.querySelector('[data-cancel]');
let session;
let loading = 0;
function unavailable(message) {
  session = null;
  choices.replaceChildren(); graph.replaceChildren();
  reveal.disabled = cancel.disabled = true;
  status.textContent = message;
}
unavailable('No source data. Load the authored demo to predict.');
host.querySelector('[data-load]').onclick = async () => {
  const request = ++loading;
  unavailable('Loading authored demo…');
  try {
    const response = await fetch('./diffusion-demo.json');
    if (!response.ok) throw Error('No source data. Demo could not be loaded.');
    const checkpoint = await response.json();
    if (request !== loading) return;
    session = createDiffusionTag(checkpoint);
    const { residents, originId, radius } = session.source.recipe;
    function svg(name, attrs) {
      const el = document.createElementNS('http://www.w3.org/2000/svg', name);
      for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
      graph.append(el); return el;
    }
    const xy = r => [35 + r.x * 12, 35 + r.y * 12];
    for (let i = 0; i < residents.length; i++) for (let j = i + 1; j < residents.length; j++) {
      const a = residents[i], b = residents[j];
      if (Math.hypot(a.x-b.x,a.y-b.y) > radius) continue;
      const [x1,y1] = xy(a), [x2,y2] = xy(b);
      svg('line', { x1,y1,x2,y2,stroke:'#8b9bb5','stroke-width':2 });
    }
    for (const r of residents) {
      const [cx,cy] = xy(r);
      svg('circle', { cx,cy,r:14,fill:r.id === originId ? '#eab54a' : '#6e92d8' });
      svg('text', { x:cx,y:cy+30,fill:'currentColor','text-anchor':'middle' }).textContent = r.id;
      if (r.id === originId) continue;
      const label = document.createElement('label'), input = document.createElement('input');
      input.type = 'checkbox'; input.value = r.id;
      label.append(input, ` ${r.id}`); choices.append(label);
    }
    reveal.disabled = cancel.disabled = false;
    status.textContent = 'Tick 0 · Ada holds the idea. Select every likely new recipient, or select none.';
  } catch (error) { if (request === loading) unavailable(error.message); }
};
cancel.onclick = () => { ++loading; session?.cancel(); unavailable('Cancelled. Checkpoint unchanged; no tick executed.'); };
reveal.onclick = async () => {
  const request = loading;
  const active = session;
  const selected = [...choices.querySelectorAll(':checked')].map(el => el.value);
  reveal.disabled = true;
  try {
    const response = await fetch('./diffusion-expected.json');
    if (!response.ok) throw Error('No source data. Pinned replay evidence unavailable.');
    const expected = await response.json();
    if (request !== loading) return;
    const result = active.reveal(selected, expected);
    for (const event of result.events) {
      const residents = active.source.recipe.residents;
      const from = residents.find(r => r.id === event.sourceId);
      const to = residents.find(r => r.id === event.receiverId);
      const edge = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      for (const [key,value] of Object.entries({ x1:35+from.x*12, y1:35+from.y*12, x2:35+to.x*12, y2:35+to.y*12, stroke:'#eab54a', 'stroke-width':5, 'data-event-id':event.id })) edge.setAttribute(key,value);
      graph.prepend(edge);
    }
    status.textContent = `${result.correct ? 'Correct prediction.' : 'Prediction missed.'} Tick 1 · ${result.events.length} new recipients. Rules: ${result.actual.recipe.rules}; seed ${result.actual.recipe.seed}. ` +
      (result.events.map(e => `${e.sourceId} → ${e.receiverId}: event ${e.id}, source event ${e.parentId}, distance ${e.distance}m, draw ${e.adoptionDraw.toFixed(4)}`).join('; ') || 'No transmissions.');
    reveal.disabled = cancel.disabled = true;
    choices.querySelectorAll('input').forEach(el => { el.disabled = true; });
  } catch (error) { if (request === loading) unavailable(error.message); }
};
