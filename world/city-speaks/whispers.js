/** Presentation only: exact district joins in one committed monthly City step. */
const wording = Object.freeze({
 FLOOD_DAMAGE:['environment','Flood damage was recorded'],
 UTILITY_CAPACITY_FAILURE:['utilities','Utility demand exceeded effective capacity'],
 PROJECT_FINANCED:['construction','A project received financing'],
 PERMIT_SUBMITTED:['construction','A permit was submitted'],
 PERMIT_GRANTED:['construction','A permit was granted'],
 CONSTRUCTION_STARTED:['construction','Construction started'],
 TOPPED_OUT:['construction','A project topped out'],
 PROJECT_COMPLETE:['construction','A project completed'],
 BUSINESS_OPENED:['businesses','A business opened'],
 BUSINESS_CLOSED:['businesses','A business closed'],
 HOUSEHOLD_BUDGET_STRESS:['housing','A household exceeded the modeled housing burden threshold'],
});
export function districtWhispers(step,districtId) {
 const districts=step?.state?.districts;
 if(!Array.isArray(districts)||districts.filter(d=>d.id===districtId).length!==1||!Array.isArray(step.events)||step.events.length>10000)return [];
 const counts=new Map();for(const e of step.events)counts.set(e?.id,(counts.get(e?.id)||0)+1);
 return step.events.filter(e=>{
  const rule=wording[e?.eventType];
  return rule&&e.system===rule[0]&&typeof e.id==='string'&&e.id.length>0&&counts.get(e.id)===1&&e.geographyId===districtId&&Number.isInteger(e.simulationTime)&&e.simulationTime===step.state.month&&typeof e.modelVersion==='string'&&e.payload?.rule?.evidenceType==='synthetic-assumption';
 }).slice(0,6).map(e=>({id:e.id,text:wording[e.eventType][1]+'.',event:structuredClone(e)}));
}
export function mountWhispers(root,steps) {
 let disposed=false,index=0,districtId=steps[0]?.state.districts[0]?.id;
 const listeners=[];
 const el=(tag,text,parent=root)=>{const node=document.createElement(tag);if(text)node.textContent=text;parent.append(node);return node;};
 const listen=(node,type,fn)=>{node.addEventListener(type,fn);listeners.push(()=>node.removeEventListener(type,fn));};
 el('h1','City Whispers');
 el('p','Synthetic monthly City results · cosmetic speech bubbles, not resident quotations. Select a neighborhood to inspect committed events.');
 const provenance=el('p');
 const label=el('label','Recorded month '),timeline=el('input',null,label);timeline.type='range';timeline.min='0';timeline.max=String(Math.max(0,steps.length-1));timeline.value='0';timeline.setAttribute('aria-label','Recorded month');
 const neighborhoods=el('nav');neighborhoods.setAttribute('aria-label','Neighborhoods');
 const cards=el('section');cards.setAttribute('aria-label','Event bubbles');
 const inspector=el('section');inspector.tabIndex=-1;inspector.setAttribute('aria-label','Event evidence');
 function render(){
  if(disposed)return;
  const step=steps[index];cards.replaceChildren();inspector.replaceChildren();
  if(!step){provenance.textContent='No recorded steps available.';return;}
  provenance.textContent=`Month ${step.state.month} · seed ${step.state.seed} · model ${step.state.version} · illustrative-city.v1 · bounded local 12-month run`;
  for(const b of neighborhoods.children)b.setAttribute('aria-pressed',String(b.dataset.id===districtId));
  const rows=districtWhispers(step,districtId);
  if(!rows.length)el('p','No supported, unambiguous event records for this neighborhood and month. Missing records do not establish that nothing happened.',cards);
  for(const row of rows){
   const bubble=el('article',null,cards);el('p',`${row.text} [Event ${row.id}]`,bubble);
   // Delegated click handling below avoids retaining listeners for retired cards.
   for(const action of ['WHY','Open event']){const b=el('button',action,bubble);b.type='button';b.dataset.event=row.id;b.dataset.action=action;}
  }
 }
 for(const d of steps[0]?.state.districts??[]){const b=el('button',d.name,neighborhoods);b.type='button';b.dataset.id=d.id;listen(b,'click',()=>{districtId=d.id;render();});}
 listen(cards,'click',e=>{const b=e.target.closest('button');if(!b||!cards.contains(b)||disposed)return;const row=districtWhispers(steps[index],districtId).find(r=>r.id===b.dataset.event);if(!row)return;inspector.replaceChildren();el('h2',`${b.dataset.action} · ${row.id}`,inspector);el('p','Exact committed synthetic record; its rule is an assumption. A recorded outcome alone does not establish a causal effect.',inspector);el('pre',JSON.stringify(row.event,null,2),inspector);inspector.focus();});
 listen(timeline,'input',()=>{index=Number(timeline.value);render();});render();
 return {destroy(){if(disposed)return;disposed=true;listeners.forEach(off=>off());root.replaceChildren();}};
}
