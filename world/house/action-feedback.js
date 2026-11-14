/** Presentation only: local sequence numbers never enter simulation commands or saves. */
export function createActionFeedback(emit){
 let sequence=0,tail=Promise.resolve(),alive=true,seen=null,pending=0;
 const completions=[];
 const flush=()=>{if(!pending)for(const record of completions.splice(0))if(alive)emit(record);};
 return {
  run(work,request={}){
   const record={sequence:++sequence,personId:request.personId,objectId:request.objectId,label:[request.system,request.type??'Household action'].filter(Boolean).join(' · ')};
   const send=(state,extra={})=>{if(alive)emit({...record,state,...extra});};
   pending++;send('pending');
   const result=tail.then(async()=>{try{const value=await work();send(value?.accepted===false?'rejected':'accepted',{reason:value?.reason,actionId:value?.actionId,taskId:value?.task?.id});return value;}catch(error){send('rejected',{reason:error.message});throw error;}finally{pending--;flush();}});
   tail=result.catch(()=>{});return result;
  },
  observe(home){
   if(!home)return;
   const completed=home.completedActions??[];
   if(seen===null){seen=new Set(completed.map(a=>a.id));return;}
   for(const action of completed)if(!seen.has(action.id)){seen.add(action.id);completions.push({state:'completed',actionId:action.id,label:action.type,minute:action.completedMinute??home.minute});}
   seen=new Set(completed.map(a=>a.id));flush();
  },
  destroy(){alive=false;}
 };
}

export function mountActionFeedback(container){
 const doc=container.ownerDocument,region=doc.createElement('section');region.className='house-action-feedback';region.setAttribute('aria-label','Household action responses');region.setAttribute('role','log');region.setAttribute('aria-live','polite');container.append(region);
 const nodes=new Map();
 const feedback=createActionFeedback(record=>{
  const key=record.sequence??'completed-'+record.actionId;let node=nodes.get(key);
  if(!node){node=doc.createElement('div');node.className='house-action-response';nodes.set(key,node);region.append(node);}
  for(const target of container.querySelectorAll('[data-person-id]'))if(target.dataset.personId===record.personId){const portrait=target.querySelector('.house-portrait');if(portrait)portrait.dataset.responseState=record.state;}
  node.dataset.state=record.state;node.dataset.sequence=record.sequence??'';node.dataset.actionId=record.actionId??'';
  const icon=doc.createElement('span');icon.className='house-action-character';icon.setAttribute('aria-hidden','true');icon.textContent=({pending:'◷',accepted:'✓',rejected:'!',completed:'★'})[record.state];
  const text=doc.createElement('span');text.textContent=record.label+' · '+({pending:'Pending acknowledgment',accepted:'Accepted',rejected:'Rejected',completed:'Completed at modeled minute '+record.minute})[record.state]+(record.reason?' · '+record.reason:'');node.replaceChildren(icon,text);
  // Bound DOM retention, preserving pending requests until their acknowledgment.
  for(const [id,old]of nodes)if(nodes.size>8&&old.dataset.state!=='pending'){old.remove();nodes.delete(id);}
 });
 return {...feedback,destroy(){feedback.destroy();region.remove();}};
}
