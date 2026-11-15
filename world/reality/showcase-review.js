import {createHash} from 'node:crypto';
import {replayRealityFuture,verifyRealityManifest} from './runtime-core.js';
export const showcaseDigest=record=>createHash('sha256').update(JSON.stringify({result:record.result,runId:record.runId,displayInitial:record.displayInitial??null})).digest('hex');
// Offline editorial prerequisite; do not execute expensive replays on gallery reads.
export async function reviewShowcaseSource(record){
 await replayRealityFuture(record.result,{runId:record.runId});
 return {id:record.id,runId:record.runId,manifestId:record.result.manifest.id,digest:showcaseDigest(record)};
}
export function projectShowcase(store,selections,now){
 const cards=[];
 for(const entry of selections.slice(0,12)){
  const consent=store.consentState(entry.id),record=store.get(entry.id,now);
  if(!consent?.enabled||consent.revision!==entry.consentRevision||!record)continue;
  const manifest=record.result.manifest;
  try{verifyRealityManifest(manifest);}catch{continue;}
  if(entry.runId!==record.runId||entry.manifestId!==manifest.id||entry.digest!==showcaseDigest(record))continue;
  if(typeof entry.title!=='string'||!entry.title.trim()||entry.title.length>100||typeof entry.summary!=='string'||entry.summary.length>300)continue;
  cards.push({id:record.id,title:entry.title,summary:entry.summary,url:`/r/${record.id}`,preview:{engine:manifest.engine,seed:record.result.runs[0].seed,horizon:manifest.engine==='city'?manifest.months:manifest.minutes,unit:manifest.engine==='city'?'months':'modeled minutes',runId:record.runId},notice:'Synthetic model assumptions. Exact source replay; no real-world certification.'});
 }
 return cards;
}
