// fetchTrace(experimentId, runId, {signal}) must return the stored run, never recompute.
export function createRecordedParentResolver({fetchTrace}) {
 let generation=0,active=null;
 function cancel(){generation++;active?.abort();active=null;}
 return {cancel,dispose:cancel,async resolve({run,scenario,projectId}){
  cancel();const token=generation,controller=new AbortController();active=controller;
  const unavailable=reason=>({status:'unavailable',reason});
  const fork=run?.fork, stored=scenario?.timelineFork;
  const reference=stored ? {...stored,parentExperimentId:stored.parentExperimentId||stored.sourceExperimentId,parentRunId:stored.parentRunId||stored.sourceRunId}:null;
  if(stored&&((stored.parentRunId&&stored.sourceRunId&&stored.parentRunId!==stored.sourceRunId)||(stored.parentExperimentId&&stored.sourceExperimentId&&stored.parentExperimentId!==stored.sourceExperimentId)))return unavailable('Conflicting source references');
  if(!fork||!reference||!reference.parentExperimentId||!reference.parentRunId)return unavailable('Missing explicit stored parent experiment/run reference');
  if(!Number.isInteger(fork.month)||fork.month!==reference.month||fork.parentSeed!==run.seed||fork.modelVersion!==run.modelVersion)return unavailable('Fork month, seed or version mismatch');
  if((fork.parentRunId&&fork.parentRunId!==reference.parentRunId)||(fork.parentExperimentId&&fork.parentExperimentId!==reference.parentExperimentId))return unavailable('Conflicting parent references');
  try{
   const parent=await fetchTrace(reference.parentExperimentId,reference.parentRunId,{signal:controller.signal});
   if(token!==generation)return unavailable('Cancelled or superseded');
   if(parent?.id!==reference.parentRunId||parent.experimentId!==reference.parentExperimentId||parent.seed!==run.seed||parent.modelVersion!==run.modelVersion||!run.modelId||parent.modelId!==run.modelId)return unavailable('Parent identity, seed or model mismatch');
   const prefix=rows=>rows?.filter(s=>s.month<=fork.month);
   const same=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&JSON.stringify(a)===JSON.stringify(b);
   const a=prefix(parent.monthlyTimeline),b=prefix(run.monthlyTimeline);
   if(!a?.some(s=>s.month===fork.month)||!same(a,b))return unavailable('Missing or divergent recorded monthly prefix');
   const original=parent.projects?.find(p=>p.projectId===projectId),branch=run.projects?.find(p=>p.projectId===projectId);
   if(!original||!branch||!same(prefix(original.states),prefix(branch.states)))return unavailable('Missing project identity or divergent recorded project prefix');
   return {status:'ready',parent,forkMonth:fork.month,projectId};
  }catch{return unavailable(token!==generation?'Cancelled or superseded':'Stored parent trace unavailable');}
 }};
}
