import { BUSINESS_CHALLENGES, businessChallengeProgress, getBusinessChallenge } from './models/business-v1/challenges.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
const quantity = (value, unit) => unit === 'money' ? money(value) : Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 });
const periodLabel = (c, count) => `${count} ${c.scale}${count === 1 ? '' : 's'}`;
const goalText = c => c.goals.map(g => `${quantity(g.target, g.unit)} ${g.label.toLowerCase()}`).join(' and ');
const statusText = progress => ({ active:'In progress', completed:'Challenge complete', failed:'Challenge ended' })[progress.status];

export function challengeReviewNotice(id) {
  const c = getBusinessChallenge(id);
  if (!c) return '';
  return `<div class="card challenge-review"><div class="eyebrow">SCENARIO CHALLENGE</div><h3>${esc(c.name)}</h3><p>Reach ${esc(goalText(c))} ${c.timing === 'deadline' ? 'at the end of' : 'within'} ${periodLabel(c,c.horizon)}, with positive cash and a business that is still trading.</p><p class="muted">Starting seed ${c.seed}. Review all assumptions below. Editing economic assumptions starts a practice run; personal bests use the original assumptions.</p></div>`;
}
export function renderBusinessChallengeBanner(container, state, onOpen, { busy = false } = {}) {
  const progress = businessChallengeProgress(state);
  container.hidden = !progress;
  if (!progress) { container.replaceChildren(); return; }
  const completed = progress.status === 'completed';
  container.innerHTML = `<div class="card challenge-banner ${completed ? 'challenge-won' : progress.status === 'failed' ? 'challenge-ended' : ''}" data-challenge-status="${progress.status}">
    <div class="row between"><div><div class="eyebrow">${progress.official ? 'SCENARIO CHALLENGE' : 'PRACTICE CHALLENGE'} · ${periodLabel(progress,progress.elapsed)} / ${progress.horizon}</div><h3>${esc(progress.name)}</h3></div><span class="pill" ${progress.status !== 'active' ? 'role="status"' : ''}>${statusText(progress)}</span></div>
    ${progress.goals.map(g => `<div class="challenge-goal"><div class="row between"><span>${esc(g.label)}</span><strong>${esc(quantity(g.value,g.unit))} / ${esc(quantity(g.target,g.unit))}</strong></div><div class="bar" role="progressbar" aria-label="${esc(g.label)}" aria-valuemin="0" aria-valuemax="${g.target}" aria-valuenow="${Math.min(g.target,Math.max(0,g.value))}" aria-valuetext="${esc(quantity(g.value,g.unit))} of ${esc(quantity(g.target,g.unit))}"><i style="width:${g.fraction*100}%"></i></div></div>`).join('')}
    <div class="row between"><p class="muted">${progress.status === 'active' ? progress.timing === 'deadline' ? `Keep trading through ${progress.scale} ${progress.horizon}; the result is settled at the deadline.` : `${periodLabel(progress,progress.remaining)} remaining. Finish with positive cash.` : esc(progress.result?.reason || '')}</p><button class="quiet" data-open-business-challenges ${busy ? 'disabled' : ''}>${progress.status === 'active' ? 'View challenges' : 'Results & retry'} →</button></div>
    ${!progress.official ? `<p class="muted">Practice: ${esc(progress.practiceReason)} Personal bests are unchanged.</p>` : ''}
    ${progress.result ? `<p class="muted">Finish: ${esc(money(progress.result.profit))} net profit · ${esc(money(progress.result.cash))} cash · ${periodLabel(progress,progress.result.period)}. You can continue this company after the challenge.</p>` : ''}
  </div>`;
  container.querySelector('[data-open-business-challenges]').onclick = onOpen;
}
export function renderBusinessChallengeCatalog(container, { state, records = {}, onStart, onContinue, hasPrevious = false, onRestore }) {
  const active = businessChallengeProgress(state);
  container.innerHTML = `<div class="eyebrow">SCENARIO CHALLENGES</div><h1>A goal worth building toward.</h1><p class="lead">Choose a fixed starting company, make your decisions, and beat the deadline. Each run uses the real business ledger, with a saved result and a personal best to chase.</p>
    ${active ? `<div class="card featured"><div class="row between"><div><span class="pill">${statusText(active)}${active.official ? '' : ' · practice'}</span><h2 class="margin-top">${esc(active.name)}</h2><p>${active.result ? esc(active.result.reason) : `${periodLabel(active,active.remaining)} left to reach ${esc(goalText(active))}.`}</p></div><div class="actions"><button class="primary" data-challenge-continue>Continue company →</button><button data-challenge-start="${active.id}">Review a fresh attempt</button></div></div></div>` : ''}
    <div class="grid two challenge-catalog">${BUSINESS_CHALLENGES.map(c => {
      const best = records[c.id];
      const validBest = best?.version === 1 && best.seed === c.seed && Number.isInteger(best.period) && best.period > 0 && best.period <= c.horizon && Number.isFinite(best.profit);
      return `<article class="card" data-business-challenge="${c.id}"><div class="row between"><span class="pill">${c.difficulty}</span><span class="muted">${periodLabel(c,c.horizon)} · seed ${c.seed}</span></div><h2 class="margin-top">${esc(c.name)}</h2><p>${esc(c.description)}</p><div class="challenge-objective"><small>THE OBJECTIVE</small><strong>${esc(goalText(c))}</strong><span class="muted">${c.timing === 'deadline' ? `At the end of ${periodLabel(c,c.horizon)}` : `Within ${periodLabel(c,c.horizon)}`} · positive cash required</span></div><p class="challenge-best ${validBest ? 'good' : 'muted'}" data-challenge-best="${c.id}">${validBest ? `Personal best: ${periodLabel(c,best.period)} · ${money(best.profit)} profit` : 'No completed challenge yet.'}</p><button class="primary" data-challenge-start="${c.id}">Review this challenge →</button></article>`;
    }).join('')}</div><p class="muted">Starting a challenge creates a fresh company after you approve its assumptions. Your current company goes into the recovery snapshot. Profits come from trading; borrowing and investment do not count as earnings. Edited assumptions and alternate future seeds are practice runs. Results are saved in this browser.</p>${hasPrevious ? '<button class="quiet" data-challenge-restore>↶ Restore previous company</button>' : ''}`;
  container.querySelectorAll('[data-challenge-start]').forEach(button => button.onclick = () => onStart(button.dataset.challengeStart));
  const restoreButton = container.querySelector('[data-challenge-restore]');
  if (restoreButton) restoreButton.onclick = onRestore;
  const continueButton = container.querySelector('[data-challenge-continue]');
  if (continueButton) continueButton.onclick = onContinue;
}
