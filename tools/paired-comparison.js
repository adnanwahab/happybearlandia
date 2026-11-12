/** Shared Worldline / inspector comparison panel. All content is rendered as text. */
export function renderPairedComparison(root,result) {
 root.replaceChildren();
 const text=(tag,value)=>{const node=document.createElement(tag);node.textContent=value;root.append(node);return node;};
 text('h3','Paired future comparison');
 text('p',result.notice);
 if(!result.compatibility.compatible)text('p','Comparison unavailable: '+result.compatibility.reasons.join('; '));
 if(result.metrics.length){const table=document.createElement('table');const header=document.createElement('tr');for(const label of ['Metric','Entity','Tick','Unit','Baseline','Child','Child − baseline','Paired seeds']){const cell=document.createElement('th');cell.textContent=label;header.append(cell);}table.append(header);
 for(const row of result.metrics){const tr=document.createElement('tr');for(const value of [row.label,row.entityId,row.tick??'unavailable',row.unit??'unavailable',row.baseline??'unavailable',row.child??'unavailable',row.delta??row.reason, row.distribution?.count?`${row.distribution.count} pairs; mean ${row.distribution.mean}; p10–p90 ${row.distribution.p10} to ${row.distribution.p90}; unpaired ${row.distribution.unpairedBaseline}/${row.distribution.unpairedChild}; invalid ${row.distribution.invalidBaseline??0}/${row.distribution.invalidChild??0}`:'unavailable']){const td=document.createElement('td');td.textContent=String(value);tr.append(td);}table.append(tr);}root.append(table);}
 if(!result.metrics.length)text('p','No comparable recorded metric observations are available.');
 if(result.graph.status==='available')text('p',`Recorded graph differences: ${result.graph.added.length} added, ${result.graph.removed.length} removed, ${result.graph.changed.length} changed dependencies.`);
 const details=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre');summary.textContent='Manifests, provenance, interventions and graph before/after';pre.textContent=JSON.stringify({baseline:result.baseline,child:result.child,interventions:result.interventions,graph:result.graph,observations:result.metrics.map(m=>({metricId:m.metricId,entityId:m.entityId,provenance:m.provenance}))},null,2);details.append(summary,pre);root.append(details);
 text('p','Seed ranges describe recorded simulations; they are not confidence intervals.');
 const intervention=document.createElement('button');intervention.type='button';intervention.textContent='Create intervention branch';intervention.disabled=true;intervention.title='Authenticated fork adapter unavailable in this public comparison view';root.append(intervention);
 text('p','Intervention unavailable: this view has no authenticated fork adapter. Recorded interventions remain visible in the evidence details.');
}
export async function mountPairedComparison(root,{runId,entityId,baselineId,endpoint='/api/causality/compare',fetcher=fetch}={}) {
 root.replaceChildren();const heading=document.createElement('h3');heading.textContent='Paired future comparison';root.append(heading);
 const status=document.createElement('p');status.setAttribute('role','status');root.append(status);
 if(!runId){status.textContent='Unavailable: this saved checkpoint has no recorded causal run ID, model manifest or paired observations.';const control=document.createElement('button');control.type='button';control.textContent='Create intervention branch';control.disabled=true;control.title='No recorded causal context or authenticated fork adapter';root.append(control);return;}
 const base=baselineId||runId,query=new URLSearchParams({baseline:base});
 const read=async q=>{const response=await fetcher(endpoint+'?'+q);if(!response.ok)throw new Error(`Recorded comparison unavailable (${response.status})`);return response.json();};
 try {status.textContent='Loading compatible recorded runs…';const data=await read(query);if(!root.isConnected)return;
 const select=document.createElement('select');select.setAttribute('aria-label','Compare child run');const empty=document.createElement('option');empty.value='';empty.textContent='Choose a compatible run';select.append(empty);
 for(const candidate of data.candidates||[]){if(candidate.runId===base)continue;const option=document.createElement('option');option.value=candidate.runId;option.textContent=candidate.runId+(candidate.compatible?'':' · '+candidate.reasons.join('; '));option.disabled=!candidate.compatible;select.append(option);}root.append(select);
 status.textContent=(data.incomplete?'Candidate list is incomplete; showing the first recorded page. ':'')+(select.options.length>1?'Select a run; incompatible records are disabled.':'No compatible recorded runs are available.');
 const output=document.createElement('div');root.append(output);let revision=0;
 select.onchange=async()=>{const current=++revision;output.replaceChildren();if(!select.value)return;try{const q=new URLSearchParams({baseline:base,child:select.value});if(entityId)q.set('entityId',entityId);const result=await read(q);if(current===revision&&root.isConnected)renderPairedComparison(output,result);}catch(error){if(current===revision)output.textContent=error.message;}};
 if(baselineId&&runId!==baselineId){select.value=runId;if(select.value)await select.onchange();}
 }catch(error){status.textContent=error.message;}
}
if(typeof document!=='undefined')document.addEventListener('worldline:selection',event=>{const {comparisonContainer,context,record}=event.detail||{};if(comparisonContainer)mountPairedComparison(comparisonContainer,{runId:context?.runId||record?.causalRunId,entityId:context?.entityId});});
