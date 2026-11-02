import { resolveConstitutionPlan, constitutionGeometry } from './constitution-visuals.js';
const $=id=>document.getElementById(id);
let frozenPlan=null;
const frames=[$('baseline'),$('proposed')];
addEventListener('message',event=>{
  if(event.origin!==location.origin || !frames.some(f=>f.contentWindow===event.source))return;
  if(event.data?.type==='constitution-camera')for(const frame of frames)if(frame.contentWindow!==event.source)frame.contentWindow.postMessage(event.data,location.origin);
  if(event.data?.type==='constitution-ready' && event.source===$('proposed').contentWindow && frozenPlan)event.source.postMessage({type:'constitution-plan',plan:frozenPlan},location.origin);
});
async function api(url,body){const response=await fetch(url,{...(body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});const value=await response.json();if(!response.ok)throw new Error(value.error||`HTTP ${response.status}`);return value;}
$('form').onsubmit=async event=>{
  event.preventDefault();$('run').disabled=true;$('results').hidden=true;frozenPlan=null;
  $('proposed').contentWindow.postMessage({type:'constitution-plan',plan:{proposalIds:[]}},location.origin);
  try{
    const text=$('idea').value.trim();if(!text)throw new Error('Enter a plan idea.');
    $('status').textContent='Synthesizing a read-only Dear Congress what-if…';
    let payload=null,upstreamError=null;
    try{payload=await api('/api/plan',{includeSynthetic:false,extraEntries:[{text,author:'HBL what-if',createdAt:new Date().toISOString()}]});}catch(error){upstreamError=error;}
    const resolved=resolveConstitutionPlan(payload,text);frozenPlan=structuredClone(resolved.plan);
    $('plan').textContent=`Frozen proposals: ${frozenPlan.actions.map(a=>a.proposalId).join(', ')}. Unsupported: ${frozenPlan.unsupported.join(', ')||'none'}.${resolved.fallback?' Using the local drainage mapping; Dear Congress did not resolve a package.':''}${upstreamError?' Synthesis unavailable: '+upstreamError.message:''}`;
    const shapes=constitutionGeometry(frozenPlan);
    $('geometry').textContent=`Schematic additions: ${[...new Set(shapes.map(s=>s.label))].join(', ')||'No physical adapter for this plan'}. These illustrate modeled interventions, not engineering designs or exact construction sites.`;
    $('proposed').contentWindow.postMessage({type:'constitution-plan',plan:frozenPlan},location.origin);
    // Pin procedural geometry on both sides and the experiment, avoiding live OSM drift.
    const job=await api('/api/world/experiments',{plan:frozenPlan,seeds:Number($('seeds').value),years:Number($('years').value),maxPeople:80,baseSeed:'constitution',procedural:true});
    const deadline=Date.now()+10*60*1000;
    for(;;){
      if(Date.now()>deadline)throw new Error('Comparison timed out. The server may still be running the experiment.');
      await new Promise(r=>setTimeout(r,1000));const status=await api(job.statusUrl);
      $('status').textContent=`${status.status}: ${status.progress?.step||0}/${status.progress?.totalSteps||'?'} paired checkpoints`;
      if(status.status==='error')throw new Error(status.error);
      if(status.status!=='done')continue;
      const result=status.result;
      $('split').textContent=`${result.meta.metrics[result.futures.metric].label}: ${result.futures.positive} better · ${result.futures.neutral} neutral · ${result.futures.negative} worse (neutral band ±${result.futures.neutralBand}).`;
      $('metrics').replaceChildren(...Object.entries(result.final).map(([key,m])=>{const div=document.createElement('div');div.className='metric';const title=document.createElement('strong');title.textContent=result.meta.metrics[key].label;const p=document.createElement('p');p.textContent=`Baseline ${m.baseline.mean} · Plan ${m.plan.mean} · Δ ${m.delta.mean}. Paired p10–p90: ${m.delta.p10} to ${m.delta.p90}.`;div.append(title,p);return div;}));
      const compact={meta:{seeds:result.meta.seeds},final:result.final,futures:{year:result.futures.year}};
      const {localConstitutionSummary,compactConstitutionResult}=await import('./constitution-summary.js');
      let summary=localConstitutionSummary(compactConstitutionResult(compact));
      try{summary=(await api('/api/constitution-summary',compact)).summary;}catch{}
      $('summary').textContent=summary;$('results').hidden=false;$('status').textContent='Comparison complete. Same town, years, residents and paired random seeds.';break;
    }
  }catch(error){$('status').textContent=error.message;}finally{$('run').disabled=false;}
};
