import {mountProjectUnblock} from './unblock-view.js';
import {createCityFromArea} from './seed.js';
const $=id=>document.getElementById(id);
const unblock=mountProjectUnblock($('project-unblock'));
let replaySource=null;
let selected=null,pollTimer=null,imported=null,replay=null,requestGeneration=0;
const n=value=>typeof value==='number'?Number(value.toFixed(2)).toLocaleString():typeof value==='object'?JSON.stringify(value):String(value??'');
function table(target,rows) {
  const root=$(target);root.replaceChildren();if(!rows.length){root.textContent='No records at this retention level.';return;}
  const table=document.createElement('table'),head=table.createTHead().insertRow(),columns=Object.keys(rows[0]);
  for(const key of columns){const th=document.createElement('th');th.textContent=key;head.append(th);}
  const body=table.createTBody();for(const row of rows){const tr=body.insertRow();for(const key of columns)tr.insertCell().textContent=n(row[key]);}
  root.append(table);
}
async function api(path,body) {
  const response=await fetch(path,body===undefined?{}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const result=await response.json();if(!response.ok)throw new Error(result.error||`Request failed: ${response.status}`);return result;
}
function status(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);}
function options(target,rows,value,label){$(target).replaceChildren(...rows.map(row=>{const el=document.createElement('option');el.value=value(row);el.textContent=label(row);return el;}));}
async function saved(){const {experiments}=await api('/api/city-experiments');$('saved').replaceChildren(...experiments.map(e=>{const button=document.createElement('button');button.textContent=`${e.experiment_id.slice(0,16)} · ${e.status}`;button.onclick=()=>select(e.experiment_id);return button;}));}
async function select(id) {
  selected=id;replay=null;replaySource=null;unblock.update(null);$('replay-summary').replaceChildren();$('replay-events').replaceChildren();$('replay-decisions').replaceChildren();$('replay-flows').replaceChildren();
  const generation=++requestGeneration;clearTimeout(pollTimer);history.replaceState(null,'',`?experiment=${id}`);
  try {
    const tables=await api(`/api/experiments/${id}/tables`);if(generation!==requestGeneration)return;
    options('tables',tables.tables,t=>t.name,t=>t.name);options('saved-query',Object.entries(tables.savedQueries),r=>r[1],r=>r[0]);
    updateCSV();await refresh(generation);
  }catch(error){status(error.message,true);}
}
async function refresh(generation=requestGeneration) {
  const id=selected;
  try {
    const result=await api(`/api/city-experiments/${id}`);if(generation!==requestGeneration)return;
    status(`${result.manifest.title} · ${result.status} · ${result.completed} / ${result.total} futures${result.error?' · '+result.error:''}`,!!result.error);
    const comparison=new Map();for(const row of result.metrics){if(!comparison.has(row.metric_id))comparison.set(row.metric_id,{metric:row.metric_id});comparison.get(row.metric_id)[row.scenario_id]=`${n(row.mean_value)} (${n(row.minimum)}–${n(row.maximum)})`;}
    table('metrics',[...comparison.values()]);options('replay-scenario',result.manifest.scenarios,s=>s.id,s=>s.id);$('replay-index').max=result.manifest.runs-1;
    const lineage=await api(`/api/experiments/${id}/lineage`);if(generation!==requestGeneration)return;
    $('manifest').textContent=JSON.stringify(lineage,null,2);$('dependencies').replaceChildren(...lineage.dependencyGraph.map(d=>{const p=document.createElement('p');p.textContent=`${d.dependsOn.join(' + ')||'Clock / external inputs'} → ${d.system}`;return p;}));
    const events=await api(`/api/experiments/${id}/query`,{sql:'SELECT system, event_type, COUNT(*) AS events FROM system_events GROUP BY system, event_type ORDER BY events DESC'});if(generation!==requestGeneration)return;table('events',events.rows);
    $('downloads').replaceChildren();if(result.status==='complete')for(const [action,label]of [['export','Download SQLite'],['brief','Decision brief']]){const a=document.createElement('a');a.href=`/api/experiments/${id}/${action}`;a.textContent=label;$('downloads').append(a);}
    if(['queued','running'].includes(result.status))pollTimer=setTimeout(()=>refresh(generation),2000);else await saved();
  }catch(error){if(generation===requestGeneration)status(error.message,true);}
}
$('experiment').onsubmit=async event=>{
  event.preventDefault();$('run').disabled=true;
  try {
    const form=new FormData(event.target),value=name=>Number(form.get(name)),districtId=form.get('district');
    const projects=[['housing',value('homes')],['transit',value('transit')],['utility',value('utility')]].filter(([,amount])=>amount>0);
    const interventions=projects.map(([type,amount])=>({type,amount,districtId,cost:value('cost')/projects.length,utility:'sewer'}));
    const body={title:form.get('title'),runs:value('runs'),months:value('months'),retention:form.get('retention'),city:{seed:value('seed'),households:value('households')},interventions,shocks:form.get('shock')?[{type:form.get('shock'),districtId,start:8,duration:3,severity:.7}]:[]};
    if(imported){body.initial=structuredClone(imported);body.initial.seed=value('seed');}
    status('Preparing experiment…');const result=await api('/api/city-experiments',body);await select(result.id);await saved();
  }catch(error){status(error.message,true);}finally{$('run').disabled=false;}
};
$('import').onchange=async event=>{
  try {const file=event.target.files[0];if(!file){imported=null;return;}if(file.size>3000000)throw new Error('Import must be under 3 MB');let state=JSON.parse(await file.text());if(state.source==='osm')state=createCityFromArea(state);if(state.schemaVersion!=='CityState.v1'||!state.districts?.length)throw new Error('Expected CityState.v1');imported=state;options('district',state.districts,d=>d.id,d=>d.name||d.id);$('import-status').textContent=`Imported ${state.households?.length||0} households · ${state.provenance?.datasetVersion||'missing dataset version'}`;}catch(error){imported=null;$('import-status').textContent=error.message;}
};
for(const button of document.querySelectorAll('[data-tab]'))button.onclick=()=>{for(const tab of document.querySelectorAll('.tab'))tab.hidden=tab.id!==button.dataset.tab;for(const b of document.querySelectorAll('[data-tab]'))b.classList.toggle('selected',b===button);};
$('saved-query').onchange=()=>{$('sql').value=$('saved-query').value;};
function updateCSV() {if(selected)$('csv').href=`/api/experiments/${selected}/export?format=csv&table=${encodeURIComponent($('tables').value)}`;}
$('tables').onchange=()=>{$('sql').value=`SELECT * FROM ${$('tables').value}`;updateCSV();};
$('query').onclick=async()=>{if(!selected)return status('Select an experiment first.',true);$('query').disabled=true;try{const result=await api(`/api/experiments/${selected}/query`,{sql:$('sql').value});table('results',result.rows);$('query-status').textContent=`${result.rows.length} rows${result.truncated?' · preview truncated':''}`;}catch(error){$('query-status').textContent=error.message;}finally{$('query').disabled=false;}};
$('replay').onclick=async()=>{
  if(!selected)return status('Select an experiment first.',true);$('replay').disabled=true;replay=null;replaySource=null;unblock.update(null);const generation=requestGeneration;const id=selected;const scenarioId=$('replay-scenario').value,runIndex=Number($('replay-index').value);
  try {status('Recomputing future from recorded inputs…');const result=await api(`/api/experiments/${id}/replay`,{scenarioId,runIndex});if(id!==selected||generation!==requestGeneration)return;replay=result;replaySource={experimentId:id,scenarioId,runIndex};$('timeline').min=result.steps[0].state.month;$('timeline').max=result.state.month;$('timeline').value=result.steps[0].state.month;renderReplay();status('Future regenerated. Inspect each month below.');}catch(error){status(error.message,true);}finally{$('replay').disabled=false;}
};
function renderReplay(){if(!replay)return;const step=replay.steps.find(s=>s.state.month===Number($('timeline').value));if(!step)return;unblock.update(step.state,{...replaySource,month:step.state.month});$('month').textContent=`Month ${step.state.month}`;$('replay-summary').textContent=step.diagnostics.map(d=>d.message).join(' · ')||'No stability diagnostics this month.';table('replay-events',step.events.map(e=>({system:e.system,event:e.eventType,district:e.geographyId,payload:e.payload})));table('replay-decisions',step.decisions.slice(0,100).map(d=>({actor:d.actorId,decision:d.decisionType,chosen:d.chosenOption,reason:d.primaryReason,alternatives:d.alternatives})));table('replay-flows',step.flows);}
$('timeline').oninput=renderReplay;
saved().catch(error=>status(error.message,true));const initialId=new URL(location.href).searchParams.get('experiment');if(initialId)select(initialId);

$('load-area').onclick=async()=>{
  $('load-area').disabled=true;
  try {const lat=Number($('latitude').value),lng=Number($('longitude').value);if(!Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lng)||Math.abs(lng)>180)throw new Error('Invalid coordinates');status('Loading OSM geometry…');const area=await api(`/api/area?lat=${lat}&lng=${lng}&radiusM=400`);imported=createCityFromArea(area,{seed:Number(document.querySelector('[name=seed]').value),households:Number(document.querySelector('[name=households]').value)});options('district',imported.districts,d=>d.id,d=>d.name);$('import-status').textContent=`${imported.buildings.length} OSM footprints · synthetic city systems`;status('Area loaded. Geometry is sourced; system assumptions remain synthetic.');}catch(error){status(error.message,true);}finally{$('load-area').disabled=false;}
};
const coords=new URL(location.href).searchParams;for(const [key,id]of [['lat','latitude'],['lng','longitude']])if(coords.has(key))$(id).value=coords.get(key);
