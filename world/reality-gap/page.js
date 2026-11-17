import { compareHistory, draftGap, enqueueDraft } from './model.js';
const $ = id => document.getElementById(id), storageKey = 'hbl.reality-gap.triage.v1';
let queue = [], comparison, storageReady = true;
try { const saved = JSON.parse(localStorage.getItem(storageKey) || '[]'); if (!Array.isArray(saved) || saved.some(item => item.schemaVersion !== 'reality-gap-draft.v1' || item.status !== 'triage')) throw new Error('Invalid queue'); queue = saved; }
catch { storageReady = false; $('status').textContent = 'Triage storage unavailable or invalid. Existing storage is preserved; drafting is disabled.'; }
function showQueue() {
  $('queue').replaceChildren();
  for (const draft of queue) { const article = document.createElement('article'); const h = document.createElement('h3'); h.textContent = draft.title; article.append(h); const p = document.createElement('p'); p.textContent = `Triage · Human review required. ${draft.question}`; article.append(p); const details = document.createElement('details'), summary = document.createElement('summary'), pre = document.createElement('pre'); summary.textContent = 'Evidence and acceptance criteria'; pre.textContent = JSON.stringify(draft,null,2); details.append(summary,pre); article.append(details); $('queue').append(article); }
}
function chart(data) {
  const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns,'svg'); svg.setAttribute('viewBox','0 0 900 360'); svg.setAttribute('role','img'); svg.setAttribute('aria-label',`${data.metric} observed and simulated with uncertainty bounds, ${data.unit}`);
  const add = (name, attrs, label) => { const el = document.createElementNS(ns,name); for (const [key,value] of Object.entries(attrs)) el.setAttribute(key,value); if (label != null) el.textContent = label; svg.append(el); return el; };
  const values = data.rows.flatMap(row => [row.observed,row.simulated].filter(p => p?.value != null).flatMap(p => [p.lower,p.upper]));
  if (!values.length) { $('chart').textContent = 'No finite values to plot.'; return; }
  let min = Math.min(...values), max = Math.max(...values); if (min === max) { min -= 1; max += 1; }
  const span = max-min; if (!Number.isFinite(span)) throw new Error('Chart range overflow.');
  const first = Date.parse(data.rows[0].date), last = Date.parse(data.rows.at(-1).date);
  const x = date => 100 + (Date.parse(date)-first)/(last-first || 1)*750, y = value => 290-(value-min)/span*240;
  for (let i=0;i<=4;i++) { const value = min+span*i/4; add('line',{x1:100,x2:850,y1:y(value),y2:y(value),stroke:'#65838e'}); add('text',{x:92,y:y(value)+5,fill:'white','text-anchor':'end','font-size':12},Number(value.toPrecision(5))); }
  add('text',{x:100,y:325,fill:'white'},data.rows[0].date); add('text',{x:850,y:325,fill:'white','text-anchor':'end'},data.rows.at(-1).date); add('text',{x:100,y:25,fill:'white'},`${data.metric} (${data.unit})`);
  for (const [key,color] of [['observed','#8af0d5'],['simulated','#ffb36b']]) {
    let previous;
    for (const row of data.rows) { const p = row[key]; if (p?.value == null) { previous = null; continue; }
      if (previous) { add('polygon',{points:`${x(previous.date)},${y(previous.p.lower)} ${x(row.date)},${y(p.lower)} ${x(row.date)},${y(p.upper)} ${x(previous.date)},${y(previous.p.upper)}`,fill:color,opacity:.18}); add('line',{x1:x(previous.date),y1:y(previous.p.value),x2:x(row.date),y2:y(p.value),stroke:color,'stroke-width':2}); }
      add('line',{x1:x(row.date),x2:x(row.date),y1:y(p.lower),y2:y(p.upper),stroke:color,opacity:.6,'stroke-width':5}); add('circle',{cx:x(row.date),cy:y(p.value),r:4,fill:color}); previous={date:row.date,p};
    }
  }
  $('chart').replaceChildren(svg);
}
$('compare').onclick = () => {
  $('result').hidden = true; comparison = null;
  try {
    const data = compareHistory(JSON.parse($('record').value)); chart(data); comparison = data;
    $('heading').textContent = `${data.metric} · ${data.geography} · ${data.unit}`;
    $('provenance').textContent = `${data.synthetic ? 'SYNTHETIC demonstration' : 'User-supplied observations (provenance unverified)'} · Source: ${data.source} · Run: ${data.runId} · Model: ${data.modelVersion} · Rules: ${data.rulesVersion} · Seed: ${data.seed} · Cutoff: ${data.cutoff} · Threshold: ${data.threshold} ${data.unit}`;
    $('inputs').textContent = JSON.stringify(data,null,2); $('rows').replaceChildren();
    const format = value => value == null ? 'Unavailable' : String(Number(value.toPrecision(6)));
    for (const row of data.rows) {
      const tr = document.createElement('tr');
      for (const value of [row.date,format(row.observed?.value),format(row.simulated?.value),format(row.signedError),format(row.absoluteError),format(row.percentageError)]) { const td = document.createElement('td'); td.textContent = value; tr.append(td); }
      const td = document.createElement('td'); td.textContent = row.status;
      if (row.large) { const button = document.createElement('button'); button.textContent = 'Draft research issue'; button.disabled = !storageReady; button.onclick = () => { try { const next = enqueueDraft(queue,draftGap(comparison,row)); localStorage.setItem(storageKey,JSON.stringify(next)); queue = next; showQueue(); $('status').textContent = 'Draft saved in triage for human review.'; } catch (error) { $('status').textContent = `Draft not saved: ${error.message}`; } }; td.replaceChildren(button); }
      tr.append(td); $('rows').append(tr);
    }
    $('result').hidden = false; $('status').textContent = 'Comparison loaded. Missing dates are not interpolated; percentages are unavailable for zero observations.';
  } catch (error) { $('status').textContent = `Comparison blocked: ${error.message}`; }
};
$('file').onchange = async () => { try { const file = $('file').files[0]; if (!file) return; if (file.size > 2_000_000) throw new Error('Maximum import size is 2 MB.'); $('record').value = await file.text(); } catch (error) { $('status').textContent = error.message; } };
$('export').onclick = () => { const url = URL.createObjectURL(new Blob([JSON.stringify(queue,null,2)],{type:'application/json'})); const a = document.createElement('a'); a.href=url; a.download='reality-gap-triage.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); };
showQueue();
