import { DEMO } from './scenario.js';
import { RULE, openDecision, moveCard, result, cancelDecision } from './model.js';
const find = id => document.getElementById(id);
let decision = openDecision(null);
const labels = { support: 'Support', oppose: 'Oppose', hold: 'Abstain / hold' };
function node(tag, text) { const el = document.createElement(tag); el.textContent = text; return el; }
find('rule').textContent = RULE;
function render(focusId) {
  const tally = result(decision);
  const ready = decision.status === 'ready';
  find('board').hidden = find('source').hidden = !ready;
  find('cancel').disabled = !ready;
  find('status').textContent = ready
    ? `${tally.winning ? 'Winning coalition' : 'Not a winning coalition'} · ${tally.support}/5 support in your bloc (3 required) · ${tally.oppose} oppose · ${tally.abstain} abstain in bloc.`
    : ({ 'no-source': 'No source data selected. Open the authored demo to begin.', 'replay-mismatch': 'Replay mismatch. Source or rules differ from the pinned demo; no result is available.', cancelled: 'Decision cancelled. No result retained; source records unchanged.' })[decision.status];
  for (const id of ['outside', 'bloc']) find(id).querySelector('.cards').replaceChildren();
  if (!ready) return;
  const cp = decision.checkpoint;
  find('decision-title').textContent = cp.title;
  find('receipt').textContent = `${cp.id} · ${cp.rulesVersion} · checkpoint ${cp.checkpointId} · source ${cp.source} · cost ${cp.proposal.cost} modeled currency`;
  for (const p of decision.positions) {
    const included = decision.selected.includes(p.id);
    const card = node('article', ''); card.className = 'card'; card.draggable = true; card.dataset.actor = p.id;
    card.append(node('h3', `${p.name} · Synthetic role`), node('strong', labels[p.current.vote]), node('p', p.goal), node('p', `${p.label}: baseline ${p.baseline ?? 'Unavailable'} → proposal ${p.outcome ?? 'Unavailable'} ${p.unit}`), node('p', p.current.reason));
    const button = node('button', included ? 'Remove from bloc' : 'Join bloc'); button.type = 'button'; button.dataset.actor = p.id;
    button.setAttribute('aria-label', `${included ? 'Remove' : 'Join'} ${p.name}${included ? ' from' : ' in'} bloc`);
    button.onclick = () => { decision = moveCard(decision, p.id, !included); render(p.id); };
    card.addEventListener('dragstart', event => event.dataTransfer.setData('text/plain', p.id));
    card.append(button); find(included ? 'bloc' : 'outside').querySelector('.cards').append(card);
  }
  if (focusId) document.querySelector(`button[data-actor="${focusId}"]`)?.focus();
}
for (const id of ['outside', 'bloc']) {
  find(id).addEventListener('dragover', event => event.preventDefault());
  find(id).addEventListener('drop', event => {
    event.preventDefault();
    const actor = event.dataTransfer.getData('text/plain');
    decision = moveCard(decision, actor, id === 'bloc'); render();
  });
}
find('demo').onclick = () => { decision = openDecision(DEMO); render(); };
find('cancel').onclick = () => { decision = cancelDecision(); render(); find('demo').focus(); };
render();
