import { mountConstitutionTimeline } from './constitution-timeline.js';
import { resolveConstitutionPlan, constitutionGeometry } from './constitution-visuals.js';
import {mountLawLibrary} from './laws/library.js';
const $=id=>document.getElementById(id);
let frozenPlan=null,generation=0;
const lawLibrary=mountLawLibrary($('law-library'),{onSelect:law=>{
  $('idea').value=law.text;
  $('idea').dispatchEvent(new Event('input',{bubbles:true}));
  timeline.reset();
  $('status').textContent=`Law ${law.number} selected. Choose Compare worlds to evaluate this plan. ${law.supported?'A reviewed model mapping is available in the law explorer.':'This proposal does not yet have a reviewed simulation mechanism; modeled effects may be unavailable.'}`;
  $('idea').focus({preventScroll:true});
  $('form').scrollIntoView({behavior:'smooth',block:'start'});
}});
addEventListener('pagehide',()=>lawLibrary.destroy(),{once:true});
const timeline=mountConstitutionTimeline($('results'));
$('idea').addEventListener('input',()=>{generation++;timeline.reset();frozenPlan=null;$('run').disabled=false;});
const frames=[$('baseline'),$('proposed')];
addEventListener('message',event=>{
  if(event.origin!==location.origin || !frames.some(f=>f.contentWindow===event.source))return;
  if(event.data?.type==='constitution-camera')for(const frame of frames)if(frame.contentWindow!==event.source)frame.contentWindow.postMessage(event.data,location.origin);
  if(event.data?.type==='constitution-ready' && event.source===$('proposed').contentWindow && frozenPlan)event.source.postMessage({type:'constitution-plan',plan:frozenPlan},location.origin);
});
async function api(url,body){const response=await fetch(url,{...(body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});const value=await response.json();if(!response.ok)throw new Error(value.error||`HTTP ${response.status}`);return value;}
$('form').onsubmit=async event=>{
  event.preventDefault();const serial=++generation;$('run').disabled=true;timeline.reset();frozenPlan=null;
  $('proposed').contentWindow.postMessage({type:'constitution-plan',plan:{proposalIds:[]}},location.origin);
  try{
    const text=$('idea').value.trim();if(!text)throw new Error('Enter a plan idea.');
    $('status').textContent='Synthesizing a read-only Dear Congress what-if…';
    let payload=null,upstreamError=null;
    try{payload=await api('/api/plan',{includeSynthetic:false,extraEntries:[{text,author:'HBL what-if',createdAt:new Date().toISOString()}]});}catch(error){upstreamError=error;}
    if(serial!==generation)return;
    const resolved=resolveConstitutionPlan(payload,text);frozenPlan=structuredClone(resolved.plan);
    $('plan').textContent=`Frozen proposals: ${frozenPlan.actions.map(a=>a.proposalId).join(', ')}. Unsupported: ${frozenPlan.unsupported.join(', ')||'none'}.${resolved.fallback?' Using the local drainage mapping; Dear Congress did not resolve a package.':''}${upstreamError?' Synthesis unavailable: '+upstreamError.message:''}`;
    const shapes=constitutionGeometry(frozenPlan);
    $('geometry').textContent=`Schematic additions: ${[...new Set(shapes.map(s=>s.label))].join(', ')||'No physical adapter for this plan'}. These illustrate modeled interventions, not engineering designs or exact construction sites.`;
    $('proposed').contentWindow.postMessage({type:'constitution-plan',plan:frozenPlan},location.origin);
    // Pin procedural geometry on both sides and the experiment, avoiding live OSM drift.
    const job=await api('/api/world/experiments',{plan:frozenPlan,seeds:Number($('seeds').value),years:Number($('years').value),maxPeople:80,baseSeed:'constitution',procedural:true});
    const deadline=Date.now()+10*60*1000;
    for(;;){
      if(serial!==generation)return;
      if(Date.now()>deadline)throw new Error('Comparison timed out. The server may still be running the experiment.');
      await new Promise(r=>setTimeout(r,1000));const status=await api(job.statusUrl);
      if(serial!==generation)return;
      $('status').textContent=`${status.status}: ${status.progress?.step||0}/${status.progress?.totalSteps||'?'} paired checkpoints`;
      if(status.status==='error')throw new Error(status.error);
      if(status.status!=='done')continue;
      const result=status.result;
      const view=timeline.show(result);
      $('status').textContent='Comparison complete. Same town, years, residents and paired random seeds.';
      // The timeline stays usable while an optional provider summary is pending.
      // A delayed response can update only the checkpoint that requested it.
      const compact={meta:{seeds:result.meta.seeds},final:view.checkpoint.final,futures:{year:view.checkpoint.futures.year}};
      api('/api/constitution-summary',compact).then(value=>{
        if(serial===generation)view.setSummary(value.summary);
      }).catch(()=>{});
      break;
    }
  }catch(error){if(serial===generation)$('status').textContent=error.message;}finally{if(serial===generation)$('run').disabled=false;}
};
