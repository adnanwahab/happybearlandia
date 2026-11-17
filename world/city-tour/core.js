// Recipes contain references and presentation text only, never executable actions.
export const TOUR_VERSION='city-tour.v1';
const idPattern=/^[A-Za-z0-9_-]{8,16}$/;
const hashPattern=/^sha256:[a-f0-9]{64}$/;
const text=(v,n)=>typeof v==='string'&&v.length<=n;
const vector=v=>Array.isArray(v)&&v.length===3&&v.every(n=>Number.isFinite(n)&&Math.abs(n)<=1e7);
export function validateRecipe(value){
 if(!value||value.version!==TOUR_VERSION||!text(value.title,100)||!Array.isArray(value.steps)||value.steps.length<3||value.steps.length>8)throw Error('A tour needs a title and 3–8 saved steps.');
 const steps=value.steps.map(s=>{
  if(!s||!idPattern.test(s.id)||!hashPattern.test(s.checksum)||!text(s.description,500)||!text(s.source,160)||!text(s.modelVersion,100)||!text(s.checkpointVersion,100)||!vector(s.pose?.position)||!vector(s.pose?.target))throw Error('Invalid checkpoint anchor or camera pose.');
  return {id:s.id,checksum:s.checksum,description:s.description,source:s.source,modelVersion:s.modelVersion,checkpointVersion:s.checkpointVersion,pose:{position:[...s.pose.position],target:[...s.pose.target]}};
 });
 return {version:TOUR_VERSION,title:value.title,steps};
}
export async function anchorRecord(record,description='',cryptoImpl=globalThis.crypto){
 if(record?.schemaVersion!=='world-experiment-record.v1'||record.save?.schemaVersion!=='world-experiment-save.v1'||!idPattern.test(record.id)||!hashPattern.test(record.checksum))throw Error('Unsupported saved checkpoint.');
 const digest=await cryptoImpl.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(record.save)));
 if('sha256:'+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')!==record.checksum)throw Error('Checkpoint integrity mismatch.');
 const s={id:record.id,checksum:record.checksum,description,source:String(record.save.geometry?.area?.source||'Unknown source')+' · submitted geometry; not source-authenticated',modelVersion:record.save.checkpoint?.modelVersion,checkpointVersion:record.save.checkpoint?.schemaVersion,pose:record.save.view?.camera};
 return validateRecipe({version:TOUR_VERSION,title:'validation',steps:[s,s,s]}).steps[0];
}
export async function resolveStep(step,fetchImpl=fetch){
 if(!idPattern.test(step?.id))throw Error('Invalid checkpoint ID.');
 const response=await fetchImpl('/api/world-experiments/'+encodeURIComponent(step.id),{cache:'no-store'});
 if(!response.ok)throw Error(response.status===403||response.status===401?'Access denied':response.status===404?'Checkpoint missing':`Checkpoint unavailable (${response.status})`);
 const record=await response.json(),actual=await anchorRecord(record,step.description);
 if(JSON.stringify(actual)!==JSON.stringify(step))throw Error('Pinned checkpoint, source or pose changed.');
 return record;
}
export function moveStep(steps,from,to){
 if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=steps.length||to>=steps.length)return steps.slice();
 const copy=steps.slice(),[item]=copy.splice(from,1);copy.splice(to,0,item);return copy;
}
export function tourURL(recipe,index){
 const clean=validateRecipe(recipe);
 if(!Number.isInteger(index)||index<0||index>=clean.steps.length)throw Error('Invalid tour position.');
 return '/world?experiment='+clean.steps[index].id+'#city-tour='+encodeURIComponent(JSON.stringify({recipe:clean,index}));
}
export function readTour(hash){
 if(!hash.startsWith('#city-tour='))return null;
 if(hash.length>60000)throw Error('Tour recipe is too large.');
 const value=JSON.parse(decodeURIComponent(hash.slice(11))),recipe=validateRecipe(value.recipe);
 if(!Number.isInteger(value.index)||!recipe.steps[value.index])throw Error('Invalid tour position.');
 return {recipe,index:value.index};
}
