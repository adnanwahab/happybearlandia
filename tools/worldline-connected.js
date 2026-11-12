/** Read-only browser for immutable stored simulation states. */
export function contextLink(path, context, origin = 'http://localhost') {
  const url = new URL(path, origin);
  for (const key of ['universeId','worldId','scenarioId','experiment','experimentId','runId','branchId','tick','time','entityId','person','future','returnTo']) {
    if (context[key] != null && context[key] !== '') url.searchParams.set(key, context[key]);
  }
  return url.pathname + url.search;
}
export function savedTime(record) {
  const t = record?.save?.checkpoint?.world?.t;
  return Number.isFinite(t) ? t : null;
}
async function mount(root) {
  const context = Object.fromEntries(new URLSearchParams(location.search));
  const heading = document.createElement('h1'); heading.textContent = 'Worldline · connected futures'; root.append(heading);
  const notice = document.createElement('p'); notice.textContent = 'Stored simulation states, not forecasts. Submitted geometry, synthetic model outputs and fictional narratives are distinct evidence sources.'; root.append(notice);
  const guide = document.createElement('a'); guide.textContent = 'Try the saved future journey';
  guide.href = contextLink('/tools/future-journey.html', context, location.origin); root.append(guide);
  const status = document.createElement('p'); status.setAttribute('role','status'); root.append(status);
  const select = document.createElement('select'); select.setAttribute('aria-label','Stored experiment'); root.append(select);
  const detail = document.createElement('div'); root.append(detail);
  const read = async path => { const response = await fetch(path); if (!response.ok) throw new Error(`Stored state unavailable (${response.status})`); return response.json(); };
  let revision = 0;
  async function show(id) {
    const current = ++revision; detail.replaceChildren(); status.textContent = 'Loading stored state…';
    try {
      const record = await read('/api/world-experiments/' + encodeURIComponent(id)); if(current !== revision) return;
      context.experiment = id;
      guide.href = contextLink('/tools/future-journey.html', context, location.origin);
      const url = new URL(location.href); url.searchParams.set('experiment',id); history.replaceState(null,'',url);
      status.textContent = 'Saved · ' + record.createdAt;
      const summary = document.createElement('p'); summary.textContent = `${record.save.label} · ${record.save.mode} · parent: ${record.parentId || 'root'} · ${record.notice || 'Stored simulation state'}`; detail.append(summary);
      const comparison = document.createElement('div'); comparison.dataset.worldlineComparison = ''; detail.append(comparison);
      root.dispatchEvent(new CustomEvent('worldline:selection', {bubbles:true, detail:{record, context:{...context}, comparisonContainer:comparison}}));
      const time = savedTime(record);
      const timeline = document.createElement('input'); timeline.type='range'; timeline.min=String(time ?? 0); timeline.max=String(time ?? 0); timeline.value=String(time ?? 0); timeline.disabled=true; timeline.setAttribute('aria-label','Recorded checkpoint time'); detail.append(timeline);
      const label = document.createElement('p'); label.textContent = time === null ? 'Checkpoint time unavailable. Historical replay is not available from this record.' : `Recorded checkpoint: ${time}. Only this checkpoint is stored; intermediate times are unavailable.`; detail.append(label);
      if(time !== null) context.time=String(time);
      for (const [title,path] of [['Enter future','/world'],['Return to experiment','/world']]) {
        const link=document.createElement('a'); link.textContent=title; link.href=contextLink(path,context,location.origin); detail.append(link);
      }
      if(record.parentId) {const link=document.createElement('button');link.textContent='Open parent';link.onclick=()=>{select.value=record.parentId;show(record.parentId);};detail.append(link);}
      const unavailable=document.createElement('p'); unavailable.textContent='Causal explanations and household entry require recorded entity/replay adapters; no explanations are inferred from summary metadata.';detail.append(unavailable);
    } catch(error) {if(current===revision)status.textContent=error.message;}
  }
  try {
    const data=await read('/api/world-experiments');
    for(const row of data.experiments || []) {const option=document.createElement('option');option.value=row.id;option.textContent=row.label || row.id;select.append(option);}
    select.onchange=()=>show(select.value);
    if(context.experiment && ![...select.options].some(o=>o.value===context.experiment)){const option=new Option(context.experiment,context.experiment);select.add(option);}
    select.value=context.experiment || select.options[0]?.value || '';
    if(select.value) await show(select.value); else {status.textContent='No stored experiments yet. Save an experiment in World to explore it here.';select.disabled=true;}
  } catch(error) {status.textContent=error.message;select.disabled=true;}
}
if(typeof document !== 'undefined') {const root=document.getElementById('connected-worldline');if(root)mount(root);}
