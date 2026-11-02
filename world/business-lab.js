import {createTrackedWorker} from "./workers/worker-registry.js";
import { ARCHETYPES, EXAMPLES, createDefinition } from './models/business-v1/content.js';
import { FIELDS, copy, approveDefinition, validateDefinition, requireApproved } from './models/business-v1/schema.js';
import { compileLocal } from './models/business-v1/compiler.js';
import { createBusinessState, defaultPlan, simulatePeriod, forecast, financeAction, purchaseProbability, validatePlan } from './models/business-v1/index.js';
import { replayFuture, suggestedPlan, searchPlans, paretoFrontier } from './models/business-v1/futures.js';

const STORAGE = 'hbl-business-lab.v1', $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: Math.abs(value) < 100 ? 2 : 0 }).format(value);
const pct = value => `${(value * 100).toFixed(1)}%`;
const num = value => Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 });
const screens = ['Describe','Plan','Run','Review','Business hub','Futures','Edit Business','Product Editor'];
let screen = 0, state = null, plan = null, draft = null, provenance = {}, warnings = [], source = '', providers = [{ id:'demo', label:'Local parser · not AI', configured:true }], provider = 'demo', futures = null, worker = null, run = null, timer = null, speed = 1, paused = false, editing = false, selectedFuture = null;
function notice(text, error = false) { $('notice').hidden = !text; $('notice').textContent = text; $('notice').className = error ? 'error' : ''; }
function save() {
  if (!state) return;
  try { localStorage.setItem(STORAGE, JSON.stringify({ schemaVersion: 'business-save.v1', state, plan })); } catch { notice('This browser could not save your company. Export a snapshot to keep it.'); }
}
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE) || 'null');
  if (saved?.schemaVersion === 'business-save.v1' && saved.state) {
    requireApproved(saved.state.def);
    if (!Number.isFinite(saved.state.cash) || !Number.isInteger(saved.state.period) || !Array.isArray(saved.state.history) || !Array.isArray(saved.state.logs)) throw new Error('Invalid save');
    state = saved.state; plan = saved.plan || defaultPlan(state.def);
    if (validatePlan(plan).length) throw new Error('Invalid saved plan');
    screen = 1;
  }
} catch { state = null; plan = null; }
function exportJson(name, data) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type:'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function renderChrome() {
  $('navigation').innerHTML = screens.map((name,i) => `<button data-screen="${i}" class="${screen === i ? 'active' : ''}" ${(!state && i > 0 && i < 7) || run || worker ? 'disabled' : ''}><span>0${i+1}</span>${name}</button>`).join('');
  $('navigation').querySelectorAll('button').forEach(b => b.onclick = () => { screen = Number(b.dataset.screen); notice(''); render(); });
  $('companyName').textContent = state?.def.name || 'An idea starts here.';
  $('companyMeta').textContent = state ? `${ARCHETYPES[state.def.archetype].label} · v${state.def.version} · seed ${state.seed}` : 'Describe it. Build it. Test its future.';
  $('globalMetrics').innerHTML = state ? `<div class="stats">${stat('Cash',money(state.cash),state.cash < 0 ? 'Credit may keep you trading' : state.logs.at(-1)?.cashChange < 0 ? `Runway ${Math.max(0,state.cash / -state.logs.at(-1).cashChange).toFixed(1)} periods at current burn` : 'Available to operate', state.cash < 0 ? 'bad' : '')}${stat('Period',`${state.period} ${state.scale}${state.period === 1 ? '' : 's'}`,state.bankrupt ? 'Bankrupt · start a new company' : run ? 'Period is running' : 'Planning is paused',state.bankrupt ? 'bad' : '')}${stat('Reputation',pct((state.reputation+1)/2),'Built by customer satisfaction')}${stat('Ownership',pct(state.ownership),`Debt ${money(state.debt)}`)}</div>` : '';
  $('newCompany').disabled = !!run || !!worker;
  try { $('restorePrevious').hidden = !localStorage.getItem(`${STORAGE}.previous`); } catch { $('restorePrevious').hidden = true; }
  $('restorePrevious').disabled = !!run || !!worker;
}
function stat(label, value, detail = '', cls = '') { return `<div class="stat"><small>${esc(label)}</small><strong class="${cls}">${esc(value)}</strong><span>${esc(detail)}</span></div>`; }
function heading(kicker,title,body) { return `<div class="eyebrow">${kicker}</div><h1>${title}</h1><p class="lead">${body}</p>`; }
function chart(history, key = 'cash') {
  const values = history.map(x => x[key]), min = Math.min(0,...values), max = Math.max(1,...values), range = max-min;
  const points = values.map((v,i) => `${35+i/Math.max(1,values.length-1)*530},${150-(v-min)/range*125}`).join(' ');
  return `<svg class="chart" role="img" aria-label="${key} over ${values.length} periods" viewBox="0 0 600 180"><path class="gridline" d="M35 25H565 M35 88H565 M35 150H565"/><text x="35" y="17">${esc(money(max))}</text><text x="35" y="174">Period ${history[0]?.period || 0}</text><text x="490" y="174">Period ${history.at(-1)?.period || 0}</text><polyline class="cashline" points="${points}"/></svg>`;
}
function providerOptions() { return providers.map(p => `<option value="${esc(p.id)}" ${p.id === provider ? 'selected' : ''} ${p.configured ? '' : 'disabled'}>${esc(p.label)}${p.configured ? '' : ' · not configured'}</option>`).join(''); }
async function propose(text, definition = null) {
  const response = await fetch('/api/business/compile', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ text, provider, ...(definition ? { definition } : {}) }), signal:AbortSignal.timeout(45000) });
  const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Compilation failed.');
  const checked = validateDefinition(result.def); if (!checked.valid) throw new Error(checked.errors.join(' '));
  return result;
}
function setDraft(result, isEdit = false) { draft = copy(result.def); delete draft.approved; delete draft.version; provenance = result.provenance || {}; warnings = result.warnings || []; source = result.source; editing = isEdit; }
function renderDescribe() {
  $('screen').innerHTML = `<div class="hero-grid"><div>${heading('A playable business laboratory','An idea.<br>A company.<br><em>500 possible futures.</em>','Start with a sentence. Review the assumptions, run the business, then find out which decisions help it survive.')}<div class="card featured"><label for="description">What business do you want to build?</label><textarea id="description" maxlength="4000" placeholder="A premium sparkling yuzu drink for gamers, sold online in 12-packs for $28.">${esc(draft?.description || EXAMPLES[0].text)}</textarea><div class="examples">${EXAMPLES.map((e,i) => `<button data-example="${i}">${e.name}</button>`).join('')}</div><div class="row between"><label>Compiler<select id="compilerProvider">${providerOptions()}</select></label><button class="primary" id="compile">Review business model →</button></div><p class="muted margin-top">Local parser works without an API key. Configured AI providers receive only your description and editable model; they return data, never simulation code.</p></div></div><div class="card"><div class="eyebrow">FROM IDEA TO INSIGHT</div><div class="steps"><div><section><b>Make assumptions visible</b><p>Costs, customers and capacity are editable estimates, not forecasts.</p></section></div><div><section><b>Operate one timeline</b><p>Plan a day at a stand or a month inside a company.</p></section></div><div><section><b>Understand every outcome</b><p>Read the P&L and see why customers walked away.</p></section></div><div><section><b>Test the same 500 futures</b><p>Compare strategies on shared seeds. Enter any future to replay it.</p></section></div></div><div class="divider"></div><a href="/world?business_mode=true">Place your company in the neighborhood ↗</a></div></div><div id="assumptions"></div>`;
  document.querySelectorAll('[data-example]').forEach(b => b.onclick = () => { $('description').value = EXAMPLES[Number(b.dataset.example)].text; });
  $('compilerProvider').onchange = e => provider = e.target.value;
  $('compile').onclick = async () => {
    const text = $('description').value; $('compile').disabled = true; $('compile').textContent = 'Building a proposal…';
    try { setDraft(await propose(text)); renderDescribe(); $('assumptions').scrollIntoView({behavior:'smooth', block:'start'}); }
    catch(e) { notice(e.message,true); $('compile').disabled = false; $('compile').textContent = 'Review business model →'; }
  };
  if (draft) renderAssumptions();
}
function renderAssumptions(target = 'assumptions') {
  const base = state?.def;
  $(target).innerHTML = `<div class="divider"></div><div class="row between"><div><div class="eyebrow">REVIEW BEFORE RUNNING</div><h2>${editing ? `Proposed definition v${base.version+1}` : 'Your business, made inspectable.'}</h2></div><span class="pill">${esc(source || 'Manual content pack')}</span></div>${warnings.map(w => `<p class="muted">${esc(w)}</p>`).join('')}
  ${editing ? `<div class="card table-wrap"><h3>Proposed changes</h3><table><thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead><tbody>${Object.keys(draft).filter(k => JSON.stringify(draft[k]) !== JSON.stringify(base[k]) && !['approved','version'].includes(k)).map(k => `<tr><td>${esc(k)}</td><td>${esc(typeof base[k] === 'object' ? JSON.stringify(base[k]).slice(0,100) : base[k])}</td><td>${esc(typeof draft[k] === 'object' ? JSON.stringify(draft[k]).slice(0,100) : draft[k])}</td></tr>`).join('') || '<tr><td colspan="3">No changes proposed.</td></tr>'}</tbody></table></div>` : ''}
  <form id="assumptionForm"><div class="grid two"><label>Company name <span class="badge inferred">editable assumption</span><input id="defName" maxlength="100" value="${esc(draft.name)}" required></label><label>Archetype <span class="badge inferred">inferred</span><select id="defArchetype" ${editing ? 'disabled' : ''}>${Object.entries(ARCHETYPES).map(([id,a]) => `<option value="${id}" ${id === draft.archetype ? 'selected' : ''}>${a.label}</option>`).join('')}</select></label><label>Period<select id="defScale" ${editing ? 'disabled' : ''}><option value="day" ${draft.scale === 'day' ? 'selected' : ''}>Stand · one day</option><option value="month" ${draft.scale === 'month' ? 'selected' : ''}>Company · one month</option></select><small>Changing scale does not rescale costs automatically; review per-period assumptions.</small></label><label>Unit sold<input id="defUnit" maxlength="100" value="${esc(draft.unit)}" required></label></div><div class="review-fields margin-top">${FIELDS.map(([id,label,min,max,unit]) => `<label class="field"><span class="row"><span>${label}</span><span class="badge ${provenance[id] || 'inferred'}" id="tag-${id}">${provenance[id] || 'inferred'}</span></span><input data-def="${id}" type="number" min="${min}" max="${max}" step="${id === 'leadTime' ? '1' : 'any'}" value="${draft[id]}" required><small>${unit}</small></label>`).join('')}</div><details><summary>All eight definition blocks · editable JSON</summary><p class="muted">Inputs, recipe, production, perishability, reference price, demand, segments and unlocks. Advanced changes are validated before approval.</p><textarea id="defAdvanced" class="mono" spellcheck="false">${esc(JSON.stringify(Object.fromEntries(['inputs','recipe','production','perishability','referencePrice','demand','segments','channels','unlock'].map(k => [k,draft[k]])), null, 2))}</textarea></details>${!editing ? '<label>Simulation seed<input id="defSeed" type="number" min="0" max="4294967295" step="1" value="42" required></label>' : ''}<label class="row margin-top"><input type="checkbox" id="approveCheck" required style="width:auto"> I reviewed these illustrative assumptions and approve this version.</label><div class="actions"><button class="primary" type="submit">${editing ? 'Approve new version' : 'Approve & start company'} →</button><button type="button" id="rejectDraft" class="quiet">Reject proposal</button></div></form>`;
  document.querySelectorAll('[data-def]').forEach(el => el.oninput = () => { const tag = $(`tag-${el.dataset.def}`); tag.textContent = 'player-set'; tag.className = 'badge player-set'; provenance[el.dataset.def] = 'player-set'; });
  $('defArchetype').onchange = e => {
    const old = draft; draft = createDefinition(e.target.value, { name:old.name, description:old.description }); provenance = {}; warnings = ['Archetype changed: costs, scale, price and capacity reset to category defaults. Review again.']; renderAssumptions(target);
  };
  $('rejectDraft').onclick = () => { draft = null; editing = false; notice('Proposal rejected. The approved company is unchanged.'); render(); };
  $('assumptionForm').onsubmit = e => {
    e.preventDefault();
    try {
      const advanced = JSON.parse($('defAdvanced').value), allowed = ['inputs','recipe','production','perishability','referencePrice','demand','segments','channels','unlock'];
      if (Object.keys(advanced).some(k => !allowed.includes(k))) throw new Error('Advanced editor accepts definition blocks only.');
      const next = { ...copy(draft), ...advanced, name:$('defName').value, unit:$('defUnit').value, scale:$('defScale').value };
      for (const el of document.querySelectorAll('[data-def]')) next[el.dataset.def] = Number(el.value);
      if (!Array.isArray(next.inputs) || !next.inputs[0]) throw new Error('Provide at least one input.');
      next.inputs[0].cost = next.unitCost;
      if (editing && (next.archetype !== state.def.archetype || next.scale !== state.scale)) throw new Error('Changing the archetype or period requires a new company.');
      const approved = approveDefinition(next, editing ? state.def.version+1 : 1);
      if (editing) { state.def = approved; plan.price = approved.price; plan.quality = approved.quality; }
      else { if (state) { try { localStorage.setItem(`${STORAGE}.previous`, JSON.stringify({state,plan})); } catch {} } state = createBusinessState(approved, Number($('defSeed').value)); plan = defaultPlan(approved); }
      draft = null; editing = false; futures = null; selectedFuture = null; screen = 1; save(); render(); notice('Assumptions approved. Plan your next period; the simulation is paused.');
    } catch(e) { notice(e.message,true); }
  };
}
function planFields() {
  return `<div class="grid">${[
    ['price','Price ($)',plan.price,.01,1e6,'any'],['quality','Quality / 100',plan.quality,1,100,1],['production',`Purchase / produce (${esc(state.def.unit)})`,plan.production,0,100000,1],['staff','Employees',plan.staff,1,100,1],['sellers','Marketplace sellers',plan.sellers,1,10000,1],
  ].filter(([key]) => key !== 'sellers' || state.def.archetype === 'marketplace').map(([id,label,value,min,max,step]) => `<label>${label}<input data-plan="${id}" type="number" value="${value}" min="${min}" max="${max}" step="${step}" required></label>`).join('')}<label>Supplier<select id="planSupplier"><option value="budget" ${plan.supplier === 'budget' ? 'selected' : ''}>Budget · 20% cheaper, 85% reliability</option><option value="standard" ${plan.supplier === 'standard' ? 'selected' : ''}>Standard · 96% reliability</option><option value="premium" ${plan.supplier === 'premium' ? 'selected' : ''}>Premium · +18% cost, 99.5% reliability</option></select></label></div><div class="divider"></div><h3>Marketing budgets · ${state.scale === 'day' ? 'daily' : 'monthly'}</h3><p class="muted">Spend builds reach and awareness with diminishing returns; it does not buy guaranteed customers.</p><div class="grid">${state.def.channels.map(c => `<label>${esc(c.label)} ($)<input type="number" data-channel="${c.id}" min="0" max="10000000" step="1" value="${plan.marketing[c.id]}" required></label>`).join('')}</div>${state.def.recipe.knobs.length ? `<h3 class="margin-top">Recipe</h3><div class="grid">${state.def.recipe.knobs.map(k => `<label>${esc(k)}<input data-recipe="${esc(k)}" type="number" min="0" max="10" value="${plan.recipe?.[k] ?? 4}" step="1"></label>`).join('')}</div>` : ''}`;
}
function readPlan() {
  const next = copy(plan);
  document.querySelectorAll('[data-plan]').forEach(el => next[el.dataset.plan] = Number(el.value));
  document.querySelectorAll('[data-channel]').forEach(el => next.marketing[el.dataset.channel] = Number(el.value));
  document.querySelectorAll('[data-recipe]').forEach(el => (next.recipe ||= {})[el.dataset.recipe] = Number(el.value));
  if ($('planSupplier')) next.supplier = $('planSupplier').value;
  const errors = validatePlan(next); if (errors.length) throw new Error(errors.join(' '));
  return next;
}
function renderPlan() {
  const forecasts = forecast(state), latest = state.logs.at(-1);
  $('screen').innerHTML = `${heading('PLAN → RUN → REVIEW',`Your next ${state.scale === 'day' ? 'day' : 'month'} starts here.`,'Take your time. Choose what to charge, what to stock and where to spend. The forecast arrives before your decisions.')}<div class="forecast">${forecasts.map(f => `<div><small>${state.scale === 'day' ? 'Day' : 'Month'} ${f.period}</small><b>${f.rain ? '🌧' : '☀'} ${f.temperature}°F</b><small>${f.label}</small></div>`).join('')}</div><div class="grid two"><div class="card featured"><div class="eyebrow">NEXT PERIOD</div><h3>${forecasts[0].label}</h3><p>${forecasts[0].warning} Weather is forecast with ±4°F error.</p><p class="muted">Inventory: ${num(state.inventory)} ${esc(state.def.unit)} · Incoming: ${num(state.pipeline.reduce((a,b) => a+b.qty,0))} · Lead time: ${state.def.leadTime} periods</p></div><div class="card"><h3>Rival watch</h3>${(latest?.rivals || [{name:'Low-cost challenger',price:state.def.referencePrice.typical*.9,strategy:'Discounter'},{name:'Premium neighbor',price:state.def.referencePrice.typical*1.4,strategy:'Premium'}]).map(r => `<p class="rival"><b>${esc(r.name)}</b> · ${money(r.price)}<br><span class="muted">${r.strategy}${latest?.share > .19 ? ' · responding to your market share' : ''}</span></p>`).join('')}</div></div><form id="planForm" class="card"><div class="row between"><h2>CEO controls</h2><span class="pill">${ARCHETYPES[state.def.archetype].constraint} constrained</span></div>${planFields()}<div class="actions"><button class="primary" type="submit" ${state.bankrupt ? 'disabled' : ''}>▶ Run next ${state.scale}</button><button type="button" id="savePlan">Save plan</button><a class="button quiet" id="worldLink" href="/world?business_mode=true">Place in the neighborhood ↗</a></div><p class="muted margin-top">Purchase costs are paid now; COGS enters P&L when units sell. Rent and wages are per period. Non-inventory archetypes ignore production orders.</p></form><div class="card"><div class="row between"><h3>Cash over time</h3><button class="quiet" id="exportSnapshot">Export replay snapshot ↓</button></div>${chart(state.history)}</div>`;
  $('savePlan').onclick = () => { try { plan = readPlan(); futures = null; save(); notice('Plan saved. Future results will be rerun against these decisions.'); } catch(e) { notice(e.message,true); } };
  $('worldLink').onclick = () => { try { plan = readPlan(); save(); } catch(e) { notice(e.message,true); return false; } };
  $('exportSnapshot').onclick = () => exportJson('hbl-business-replay.json', { modelId:'business-v1', modelVersion:'1.0.0', state, plan });
  $('planForm').onsubmit = e => { e.preventDefault(); try { plan = readPlan(); startPeriod(); } catch(e) { notice(e.message,true); } };
}
function startPeriod() {
  const result = simulatePeriod(state, plan);
  run = { ...result, progress:0 }; paused = false; speed = 1; futures = null; screen = 2; notice(''); render();
  timer = setInterval(() => { if (!paused && run) { run.progress = Math.min(1,run.progress+.0125*speed); updateRun(); if (run.progress >= 1) finishPeriod(); } },80);
}
function finishPeriod() {
  clearInterval(timer); if (!run) return; state = run.state; run = null; screen = 3; save(); render(); notice('Period complete. Review the results before planning again.');
}
function renderRun() {
  if (!run) { $('screen').innerHTML = `${heading('RUN VIEW','Ready when you are.','The engine resolves the period, then plays its customer trace. Planning remains untimed.')}<div class="card empty"><p>Set your next plan to see customers and their decisions.</p><button class="primary" id="goPlan">Open plan →</button></div>`; $('goPlan').onclick = () => {screen=1;render();}; return; }
  $('screen').innerHTML = `${heading('LIVE TRACE',`Running ${state.scale} ${state.period+1}.`,'Every thought bubble comes from the same outcome log you will see in the review.')}<div class="row between"><span id="runClock"></span><div class="row">${[1,2,4].map(s => `<button data-speed="${s}" class="${s===speed?'primary':''}">${s}×</button>`).join('')}<button id="pauseRun">Pause</button><button id="finishRun">Skip to review →</button></div></div><div class="progress"><i id="runProgress"></i></div><div class="run-stage"><div class="stall">🐻<b>${esc(state.def.name)}</b>${money(plan.price)} / ${esc(state.def.unit)}</div><div class="walker" id="walker">🚶</div><div class="bubble" id="thought">Doors are opening…</div></div><div class="stats" id="runMetrics"></div><div class="trace" id="runTrace" role="log" aria-label="Customer outcome trace"></div>`;
  document.querySelectorAll('[data-speed]').forEach(b => b.onclick = () => {speed=Number(b.dataset.speed);document.querySelectorAll('[data-speed]').forEach(x => x.classList.toggle('primary',x===b));});
  $('pauseRun').onclick = () => {paused=!paused;$('pauseRun').textContent=paused?'Resume':'Pause';};
  $('finishRun').onclick = finishPeriod; updateRun();
}
function updateRun() {
  if (!run || !$('runProgress')) return;
  const end = Math.floor(run.trace.length*run.progress), trace = run.trace.slice(0,end), sold = trace.filter(t => t.reason==='bought').length;
  $('runProgress').style.width = `${run.progress*100}%`; $('runClock').textContent = state.scale==='day' ? `${9+Math.floor(run.progress*8)}:${String(Math.floor(run.progress*480)%60).padStart(2,'0')}` : `${Math.round(run.progress*100)}% of month resolved`;
  $('walker').style.left = `${(run.progress*400)%95}%`;
  $('thought').textContent = trace.at(-1) ? `${trace.at(-1).segment}: ${trace.at(-1).reason}` : 'Doors are opening…';
  $('runMetrics').innerHTML = stat('Arrivals',num(end))+stat('Purchases',num(sold))+stat('Lost sales',num(end-sold))+stat('Period',`${state.period+1}`);
  $('runTrace').innerHTML = trace.slice(-9).reverse().map(t => `<div><span class="${t.reason==='bought'?'good':'gold'}">${esc(t.reason)}</span> · ${esc(t.segment)} · customer ${t.customer}</div>`).join('');
}
function renderReview() {
  const r = state.logs.at(-1);
  if (!r) { $('screen').innerHTML = '<div class="card empty"><h2>Your first review is waiting.</h2><p>Run a period from the Plan screen to see real results here.</p></div>'; return; }
  $('screen').innerHTML = `${heading(`PERIOD ${r.period} · REVIEW`,`The numbers tell a story.`,`${num(r.arrivals)} potential customers. ${num(r.outcomes.bought)} purchases. Here is what worked, what cost money, and why the others walked away.`)}<div class="stats">${stat('Revenue',money(r.revenue))}${stat('Net profit',money(r.profit),'Accrual P&L',r.profit<0?'bad':'good')}${stat('Cash change',money(r.cashChange),'Purchases paid upfront')}${stat('Satisfaction',pct(r.satisfaction),'Of customers served')}</div><div class="grid two"><div class="card"><h3>Every arrival accounted for</h3>${Object.entries(r.outcomes).map(([reason,count]) => `<div class="bar-row"><span>${esc(reason)}</span><div class="bar"><i style="width:${count/Math.max(1,r.arrivals)*100}%;background:${reason==='bought'?'var(--green)':'var(--gold)'}"></i></div><span>${num(count)}</span></div>`).join('')}<p class="muted margin-top">Counts sum to ${num(Object.values(r.outcomes).reduce((a,b)=>a+b,0))} arrivals. Rival purchases use the same utility model.</p></div><div class="card"><h3>Profit & loss</h3><table><tbody>${[['Revenue',r.revenue],['Cost of goods sold',-r.cogs],['Spoilage',-r.spoilageCost],['Gross profit',r.revenue-r.cogs-r.spoilageCost],['Rent',-r.rent],['Wages',-r.wages],['Marketing',-r.marketingCost],['Interest',-r.interest],['Net profit',r.profit]].map(([k,v])=>`<tr><td>${k}</td><td class="${v<0?'bad':'good'}">${money(v)}</td></tr>`).join('')}</tbody></table><p class="muted margin-top">Cash purchases ${money(r.inputCash)} · Upgrades ${money(r.equipmentPurchase+r.tierCost)} · Spoiled units ${num(r.spoiled)} · Cash ${money(r.cash)}</p></div></div><div class="grid">${r.channelCards.map(c => `<div class="card"><div class="eyebrow">${esc(c.label)}</div><h3>${money(c.spend)} → ${num(c.customers)} customers</h3><p>${num(c.impressions)} impressions → ${num(c.visitors)} visitors</p><span class="pill">CAC ${c.cac===null?'—':money(c.cac)}</span><p class="muted margin-top">Customer attribution is proportional to modeled channel visitors, not causal measurement.</p></div>`).join('')}</div><div class="grid two"><div class="card"><h3>Operational review</h3><p>Capacity used: ${num(r.used)} / ${num(r.capacity)} (${pct(r.utilization)})<br>Remaining inventory: ${num(r.inventory)}<br>Supplier: ${r.supplierDelivered?'order delivered':'order failed; purchase refunded'}</p>${state.def.archetype==='subscription'?`<p>MRR ${money(r.mrr)} · ARR ${money(r.arr)} · Churned ${num(r.churned)}</p>`:''}<p class="muted">${r.weather.label} · ${r.weather.temperature}°F ${r.weather.rain?'rain':'dry'} · Reputation ${pct((r.reputation+1)/2)}</p></div><div class="card"><h3>Cash trajectory</h3>${chart(state.history)}</div></div><div class="actions"><button class="primary" id="continue">Plan next ${state.scale} →</button><button id="reviewFutures">Explore 500 futures ↗</button></div>${state.bankrupt?'<p class="bad margin-top">The company has reached its cash failure state. You can still explore past results; start a new company to play again.</p>':''}`;
  $('continue').onclick=()=>{screen=1;render();}; $('reviewFutures').onclick=()=>{screen=5;render();};
}
function renderHub() {
  const floors = ['Warehouse / stock','Production','Sales','Support','Management'].slice(0,Math.min(5,1+Math.floor(state.totalRevenue/Math.max(1,state.def.startingCash*.3))));
  $('screen').innerHTML = `${heading('BUSINESS HUB','Room to grow.','Upgrade the variables you already know: location brings traffic and rent; equipment raises quality and capacity; staffing raises throughput and wages.')}<div class="grid two"><div class="card"><h3>Your headquarters</h3><div class="hq">${floors.map(f=>`<div>${f}</div>`).join('')}</div><p class="muted">${floors.length} symbolic floors · grows with cumulative sales. Place the company in HBL to see residents visit.</p><a class="button" href="/world?business_mode=true">Enter the neighborhood ↗</a></div><div class="card"><h3>Progression</h3><form id="upgradeForm"><label>Location tier<select id="locationTier">${['Stand','Cart','Kiosk','Storefront','Chain'].map((x,i)=>`<option value="${i+1}" ${plan.location===i+1?'selected':''}>${x} · ${i+1}× rent · +${i*25}% traffic</option>`).join('')}</select></label><label class="margin-top">Equipment level (0–5)<input id="equipmentLevel" type="number" min="0" max="5" step="1" value="${plan.equipment||0}" required></label><p class="muted margin-top">Next run charges ${money(state.def.price*80)} per new equipment level and ${money(state.def.rent*20)} per new location tier. Equipment cannot be downgraded. No charge occurs before a run.</p><button type="submit">Schedule upgrades in plan</button></form></div></div><div class="card"><h3>Financing</h3><p>Cash ${money(state.cash)} · Debt ${money(state.debt)} · Founder ownership ${pct(state.ownership)}<br>Credit limit ${money(Math.max(state.def.startingCash*.2,state.totalRevenue*.5))}. Interest ${state.scale==='day'?'0.05% per day':'1.5% per month'}.</p><form id="financeForm" class="grid"><label>Action<select id="financeType"><option value="loan">Borrow</option><option value="repay">Repay loan</option><option value="equity" ${state.scale==='day'?'disabled':''}>Raise equity funding</option></select></label><label>Amount ($)<input id="financeAmount" type="number" min="1" max="100000000" value="${Math.round(state.def.startingCash*.1)}" required></label><div class="actions"><button type="submit">Apply financing</button></div></form><p class="muted margin-top">Investors require two months and sales ≥10% of starting cash. Valuation = max(starting cash, 4× lifetime revenue); dilution is amount ÷ (valuation + amount). This uses simulated money.</p></div>`;
  $('upgradeForm').onsubmit=e=>{e.preventDefault();const equipment=Number($('equipmentLevel').value);if(equipment<state.equipment){notice('Equipment cannot be downgraded.',true);return;}plan.equipment=equipment;plan.location=Number($('locationTier').value);futures=null;save();notice('Upgrades scheduled. Review the plan and run a period to purchase them.');};
  $('financeForm').onsubmit=e=>{e.preventDefault();try{state=financeAction(state,$('financeType').value,Number($('financeAmount').value));futures=null;save();render();notice('Financing applied to simulated cash.');}catch(err){notice(err.message,true);}};
}
function renderFutures() {
  const summary = futures?.summaries[0], stale = futures && futures.defVersion !== state.def.version;
  $('screen').innerHTML = `${heading('FUTURES LAB','One plan. Many possible endings.','Continue from your current company on 500 seeded timelines. Test a strategy against exactly the same seeds; compare the distribution before committing.')}<div class="card"><div class="row between"><div><h3>${summary?`${summary.count} futures completed`:'Explore the uncertainty'}</h3><p class="muted">Random seeds vary weather, demand, supply and customer choices. Inferred assumptions stay fixed; this is scenario exploration, not a forecast.</p></div><div class="row"><label>Horizon (${state.scale==='day'?'days':'months'})<input id="futureHorizon" type="number" min="1" max="60" step="1" value="${futures?.horizon || (state.scale==='day'?30:24)}" style="width:100px"></label><button class="primary" id="runFutures" ${state.bankrupt?'disabled':''}>Run 500 futures</button><button id="cancelFutures" ${worker?'':'hidden'}>Cancel</button></div></div><div class="progress" id="futureProgress" ${worker?'':'hidden'}><i></i></div><p class="muted" id="futureStatus">${stale?'Stale: the business definition changed. Rerun to compare.':summary?`Definition v${futures.defVersion} · seed ${futures.initial.seed} · ${futures.horizon} periods from period ${futures.initial.period}`:'Runs in a Web Worker using the HBL experiment kernel.'}</p><div id="futureResults">${summary?futureResults(summary):''}</div></div><div id="futureDetail"></div>`;
  $('runFutures').onclick=()=>launchFutures(); $('cancelFutures').onclick=()=>{worker?.terminate();worker=null;render();notice('Futures cancelled. No company changes were made.');};
  if(summary) bindFutureResults();
}
const bucketLabels={profitable:'Profitable',small:'Survive, stay small',funding:'Need funding',bankrupt:'Run out of cash'};
function futureResults(summary) {
  return `<div class="stats">${stat('Survival',pct(summary.survival))}${stat('Median cash',money(summary.medianCash))}${stat('Cash · 10th percentile',money(summary.p10))}${stat('Cash · 90th percentile',money(summary.p90))}</div><div class="legend">${Object.entries(summary.buckets).map(([key,count])=>`<span><i style="background:var(--${({profitable:'green',small:'cyan',funding:'gold',bankrupt:'red'})[key]})"></i>${bucketLabels[key]} ${pct(count/Math.max(1,summary.count))}</span>`).join('')}</div><div class="dots" aria-label="Future outcomes">${summary.runs.map((r,i)=>`<button class="dot ${r.bucket}" data-future="${i}" aria-label="Future ${i+1}: ${bucketLabels[r.bucket]}, cash ${money(r.metrics.cash)}" title="${i+1} · ${bucketLabels[r.bucket]} · ${money(r.metrics.cash)}"></button>`).join('')}</div><p class="muted">Each dot is a completed run. Select one to inspect its timeline. ${summary.failed?`${summary.failed} failed runs are excluded.`:''}</p><div class="grid two"><div><h3>What distinguishes vulnerable futures?</h3>${summary.causes.length&&summary.causes[0].adverseTotal?summary.causes.slice(0,4).map(c=>`<p><b>${pct(c.adverseShare)}</b> ${esc(c.cause)}<br><span class="muted">${c.adverseCount} / ${c.adverseTotal} funding or bankrupt runs, versus ${pct(c.otherShare)} of other runs.</span></p>`).join(''):'<p>No funding or bankruptcy bucket to attribute in this batch. Inspect other outcomes or test a longer horizon.</p>'}<p class="muted">These are over-represented conditions, not proof of causation. Paired strategy tests measure changes within this model.</p></div><div class="card featured"><div class="eyebrow">TEST A HYPOTHESIS</div><h3>A concrete change, fairly compared.</h3><p>${esc(suggestedPlan(plan,summary).explanation)}</p><div class="actions"><button id="testStrategy">Test strategy · same 500 seeds</button><button class="quiet" id="searchPlans">Find a better plan</button></div><p class="muted margin-top">Search evaluates three alternatives and marks the non-dominated frontier for survival, cash and sales. You choose the trade-off.</p></div></div>${futures.summaries.length>1?`<div class="table-wrap"><h3>Paired comparison · ${futures.horizon} periods</h3><table><thead><tr><th>Strategy</th><th>Survival</th><th>Median cash</th><th>Frontier</th><th>Action</th></tr></thead><tbody>${futures.summaries.map((s,i)=>`<tr><td>${i?'Alternative '+i:'Current plan'}</td><td>${pct(s.survival)}</td><td>${money(s.medianCash)}</td><td>${paretoFrontier(futures.summaries).some(x=>x.index===i)?'● Pareto':''}</td><td>${i?`<button data-adopt="${i}">Review plan</button>`:'Baseline'}</td></tr>`).join('')}</tbody></table><p class="muted">Each comparison shares run seeds and exogenous random streams. Matched pairs: ${futures.summaries[0].count}. Alternatives are never adopted automatically.</p></div>`:''}<button class="quiet margin-top" id="exportFutures">Export futures & replay inputs ↓</button>`;
}
function launchFutures(alternatives=[]) {
  const horizon=Number($('futureHorizon').value);
  if(!Number.isInteger(horizon)||horizon<1||horizon>60){notice('Choose a whole-number horizon from 1 to 60 periods.',true);return;}
  if(state.bankrupt){notice('Start a new company before running future operations.',true);return;}
  const initial=copy(state), current=copy(plan);
  if(worker) worker.terminate();
  worker=createTrackedWorker('/world/models/business-v1/futures.worker.js',{type:'module'},{type:'Simulation',ownership:{system:'business-futures'}});
  renderChrome(); $('runFutures').disabled=true; $('cancelFutures').hidden=false; $('futureProgress').hidden=false;
  $('futureStatus').textContent='Starting seeded futures…'; notice('');
  $('futureResults').querySelectorAll('button').forEach(b=>b.disabled=true);
  worker.onmessage=({data})=>{
    if(data.type==='progress') { $('futureProgress').querySelector('i').style.width=`${data.progress.completed/data.progress.total*100}%`; $('futureStatus').textContent=`${data.progress.completed} / ${data.progress.total} matched runs · ${(data.progress.elapsedMs/1000).toFixed(1)}s`; }
    if(data.type==='done') {worker.terminate();worker=null;futures=data.result;selectedFuture=null;render();notice(`Completed ${futures.summaries.reduce((a,s)=>a+s.count,0)} runs. Your company is unchanged.`);}
    if(data.type==='error') {worker.terminate();worker=null;render();notice(data.error,true);}
  };
  worker.onerror=()=>{worker.terminate();worker=null;render();notice('The futures worker could not finish. Reduce the horizon or try again.',true);};
  worker.postMessage({state:initial,plan:current,options:{count:500,horizon,alternatives}});
}
function bindFutureResults() {
  document.querySelectorAll('[data-future]').forEach(b=>b.onclick=()=>showFuture(Number(b.dataset.future)));
  $('testStrategy').onclick=()=>launchFutures([suggestedPlan(plan,futures.summaries[0]).plan]);
  $('searchPlans').onclick=()=>launchFutures(searchPlans(plan));
  $('exportFutures').onclick=()=>exportJson('hbl-business-futures.json',futures);
  document.querySelectorAll('[data-adopt]').forEach(b=>b.onclick=()=>{
    const proposed=futures.plans[Number(b.dataset.adopt)];
    $('futureDetail').innerHTML=`<div class="card"><h2>Review proposed plan</h2><table><thead><tr><th>Lever</th><th>Before</th><th>After</th></tr></thead><tbody>${['price','quality','production','staff'].map(k=>`<tr><td>${k}</td><td>${num(plan[k])}</td><td>${num(proposed[k])}</td></tr>`).join('')}${Object.keys(plan.marketing).map(k=>`<tr><td>${k} budget</td><td>${money(plan.marketing[k])}</td><td>${money(proposed.marketing[k])}</td></tr>`).join('')}</tbody></table><div class="actions"><button class="primary" id="adoptPlan">Approve this plan</button><button id="rejectPlan">Keep current plan</button></div></div>`;
    $('adoptPlan').onclick=()=>{plan=copy(proposed);futures=null;save();screen=1;render();notice('Alternative plan approved. Plan your next period.');};
    $('rejectPlan').onclick=()=>$('futureDetail').innerHTML='';
    $('futureDetail').scrollIntoView({behavior:'smooth'});
  });
}
function showFuture(index) {
  const replay=replayFuture(futures,index), row=futures.summaries[0].runs[index]; selectedFuture={index,replay};
  $('futureDetail').innerHTML=`<div class="card"><div class="eyebrow">FUTURE ${index+1} · SEED ${row.seed}</div><h2>${bucketLabels[row.bucket]} · ${money(row.metrics.cash)} cash</h2>${chart(replay.state.history)}<div class="table-wrap"><table><thead><tr><th>Period</th><th>Sales</th><th>Profit</th><th>Cash</th></tr></thead><tbody>${replay.reports.map(r=>`<tr><td>${r.period}</td><td>${money(r.revenue)}</td><td>${money(r.profit)}</td><td>${money(r.cash)}</td></tr>`).join('')}</tbody></table></div><p class="muted margin-top">Replay matches this future's seed, approved definition and fixed plan. Entering switches your active company to this ending; your previous company is kept as a recovery snapshot.</p><div class="actions"><button class="primary" id="enterFuture">Enter this future →</button><button id="closeFuture">Close</button></div></div>`;
  $('enterFuture').onclick=()=>{try{localStorage.setItem(`${STORAGE}.previous`,JSON.stringify({state,plan}));}catch{}state=copy(replay.state);plan=copy(futures.plans[0]);futures=null;save();screen=3;render();notice(`Entered future ${index+1}. Its timeline and headquarters are now your active company.`);};
  $('closeFuture').onclick=()=>$('futureDetail').innerHTML='';
  $('futureDetail').scrollIntoView({behavior:'smooth'});
}
function renderEdit() {
  $('screen').innerHTML=`${heading('PROPOSE → REVIEW → APPROVE','Change the idea. Keep the receipts.','Request an edit in plain language. Review a before-and-after diff, edit the assumptions, then approve a new definition version. Existing futures are invalidated.')}<div class="card"><label for="editText">What would you change?</label><textarea id="editText" maxlength="4000" placeholder="Raise price to $3 and quality to 85."></textarea><div class="row between margin-top"><label>Compiler<select id="editProvider">${providerOptions()}</select></label><button class="primary" id="proposeEdit">Propose changes →</button></div><p class="muted margin-top">The local parser supports explicit price, quality, capacity and unit cost changes. AI providers can propose any valid definition fields. Archetype and period changes require a new company.</p></div><div id="editReview"></div>`;
  $('editProvider').onchange=e=>provider=e.target.value;
  $('proposeEdit').onclick=async()=>{const text=$('editText').value;$('proposeEdit').disabled=true;try{setDraft(await propose(text,state.def),true);renderEdit();renderAssumptions('editReview');}catch(e){notice(e.message,true);$('proposeEdit').disabled=false;}};
  if(draft&&editing)renderAssumptions('editReview');
}
function renderEditor() {
  const content=copy(draft || state?.def || createDefinition()); delete content.approved;delete content.version;
  $('screen').innerHTML=`${heading('PRODUCT EDITOR','The model is data. Make it yours.','Create, import or export a BusinessDef content pack. Every imported pack is validated and reviewed before it can become a playable company.')}<div class="grid two"><div class="card"><h3>BusinessDef · JSON</h3><textarea id="productJson" class="mono" spellcheck="false">${esc(JSON.stringify(content,null,2))}</textarea><div class="actions"><button class="primary" id="reviewProduct">Validate & review</button><button id="exportProduct">Export pack ↓</button></div><label class="margin-top">Import a pack (JSON, ≤32 KiB)<input id="importProduct" type="file" accept=".json,application/json"></label><p class="muted margin-top" id="productValidation">Edits here are proposals. No changes are applied automatically.</p></div><div class="card"><div class="eyebrow">LIVE MODEL PREVIEW</div><h3>Price vs purchase intent</h3><div id="pricePreview"></div><p class="muted">Logistic utility for the first segment at neutral reputation. This excludes rivals, awareness, inventory and customer budgets.</p><div class="divider"></div><h3>Eight shared definition blocks</h3><p>Inputs · Recipe · Production · Perishability · Reference price · Demand · Segments · Unlocks</p><p class="muted">The current engine supports one active product per company. Multi-SKU cannibalization, hybrid adapters, hourly per-input decay and multi-location chains are future extensions.</p></div></div>`;
  const preview=()=>{try{const d=JSON.parse($('productJson').value), checked=validateDefinition(d);if(!checked.valid)throw new Error(checked.errors.join(' '));const segment=d.segments[0], points=Array.from({length:51},(_,i)=>{const price=d.referencePrice.max*i/50,u=segment.quality*d.quality/100-segment.sensitivity*price/d.referencePrice.typical+1.1*segment.affinity;return `${35+i*10.6},${150-purchaseProbability(u)*125}`;});$('pricePreview').innerHTML=`<svg class="chart" viewBox="0 0 600 180" role="img" aria-label="Purchase intent declines as price rises"><path class="gridline" d="M35 25H565 M35 150H565"/><text x="35" y="18">100% intent</text><text x="35" y="174">$0</text><text x="500" y="174">${money(d.referencePrice.max)}</text><polyline class="cashline" points="${points.join(' ')}"/></svg>`;$('productValidation').textContent='Valid BusinessDef. Ready for review.';}catch(e){$('productValidation').textContent=e.message;$('pricePreview').innerHTML='<p>Preview appears when the pack is valid.</p>';}};
  $('productJson').oninput=preview;preview();
  $('importProduct').onchange=async e=>{const file=e.target.files[0];if(!file)return;if(file.size>32768){notice('Content pack exceeds 32 KiB.',true);return;}$('productJson').value=await file.text();preview();};
  $('exportProduct').onclick=()=>{try{const def=JSON.parse($('productJson').value);const checked=validateDefinition(def);if(!checked.valid)throw new Error(checked.errors.join(' '));delete def.approved;delete def.version;exportJson('business-content-pack.json',def);}catch(e){notice(e.message,true);}};
  $('reviewProduct').onclick=()=>{try{const def=JSON.parse($('productJson').value);const checked=validateDefinition(def);if(!checked.valid)throw new Error(checked.errors.join(' '));setDraft({def,source:'Imported / manual pack',warnings:['All content-pack assumptions require review.']});screen=0;render();$('assumptions').scrollIntoView({behavior:'smooth'});}catch(e){notice(e.message,true);}};
}
function render() {window.scrollTo(0,0);renderChrome();[renderDescribe,renderPlan,renderRun,renderReview,renderHub,renderFutures,renderEdit,renderEditor][screen]();}
$('newCompany').onclick=()=>{if(state){try{localStorage.setItem(`${STORAGE}.previous`,JSON.stringify({state,plan}));localStorage.removeItem(STORAGE);}catch{}}state=null;plan=null;draft=null;futures=null;screen=0;editing=false;render();notice('Ready for a new idea. Your previous company is saved as a recovery snapshot.');};
$('restorePrevious').onclick = () => {
  try {
    const previous = JSON.parse(localStorage.getItem(`${STORAGE}.previous`) || 'null');
    if (!previous?.state) throw new Error('No recovery snapshot is available.');
    requireApproved(previous.state.def);
    if (validatePlan(previous.plan).length) throw new Error('The recovery plan is invalid.');
    if (state) localStorage.setItem(`${STORAGE}.previous`, JSON.stringify({state,plan}));
    state = previous.state; plan = previous.plan; draft = null; futures = null; screen = 1; save(); render(); notice('Previous company restored.');
  } catch(e) { notice(e.message,true); }
};
render();
fetch('/api/business/providers').then(r=>r.json()).then(result=>{if(Array.isArray(result.providers)){providers=result.providers;const select=$('compilerProvider')||$('editProvider');if(select)select.innerHTML=providerOptions();}}).catch(()=>{});
