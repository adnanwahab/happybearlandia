import {normalizeDearCongressPlan} from './plan.js';
export async function loadConstitutionSource({refresh=false,signal,packageId,search=globalThis.location?.search||'',fetchImpl=fetch}={}){
 const params=new URLSearchParams(search);
 const checkPlan=plan=>{const requested=params.get('planId');if(requested&&requested!==plan.id&&(!refresh||snapshotId))throw Error('The source plan changed after this link was created. Reopen World Diff to inspect the current package.');return plan;};
 const snapshotId=params.get('sourceSnapshot');
 if(snapshotId){
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(snapshotId))throw Error('Invalid frozen source snapshot identifier.');
  let endpoint='/api/dear-congress/simulation-snapshots/'+encodeURIComponent(snapshotId);
  const suppliedOrigin=params.get('sourceOrigin');
  if(suppliedOrigin){const origin=new URL(suppliedOrigin);if(origin.username||origin.password)throw Error('Source origins cannot include credentials.');if(!((origin.protocol==='https:'&&origin.hostname==='dear-congress.fly.dev')||(['localhost','127.0.0.1','[::1]'].includes(origin.hostname)&&['http:','https:'].includes(origin.protocol))))throw Error('Use the configured Dear Congress source or a local development source.');endpoint=new URL('/api/simulation-snapshots/'+encodeURIComponent(snapshotId),origin.origin).href;}
  const response=await fetchImpl(endpoint,{signal}),data=await response.json();if(!response.ok||!data.snapshot)throw Error(data.error||'The requested frozen plan is unavailable; no current-plan substitute was loaded.');
  const snapshot=data.snapshot;if(snapshot.id!==snapshotId||!Array.isArray(snapshot.plan?.items))throw Error('Frozen source identity or policy entries are invalid.');
  const id=snapshot.plan.id||packageId||'A';if(packageId&&packageId!==id)throw Error('The requested package does not match this frozen snapshot.');
  const source={schemaVersion:'dear-congress-plan-source.v1',snapshotId,sourceUrl:new URL('/api/simulation-snapshots/'+encodeURIComponent(snapshotId),suppliedOrigin||'https://dear-congress.fly.dev').href,sourceEndpoint:endpoint,retrievedAt:snapshot.createdAt,sourceMode:'frozen-snapshot',packageId:id,packages:[{id,name:snapshot.plan.label,items:snapshot.plan.items.map(item=>({proposal:{id:item.id,title:item.title||item.label,needId:item.needId,costB:item.costB}}))}]};
  const plan=normalizeDearCongressPlan(source,{sourceUrl:source.sourceUrl,retrievedAt:source.retrievedAt,packageId:id});Object.assign(plan.provenance,{snapshotId,sourceMode:'frozen-snapshot',sourceEndpoint:endpoint});return{plan:checkPlan(plan),source};
 }
 let response=await fetchImpl('/api/constitution-city/plan',{method:refresh?'POST':'GET',signal});
 // Existing running dev servers can still serve the captured public snapshot.
 if(!refresh&&response.status===404)response=await fetchImpl(new URL('./dear-congress-plan.json',import.meta.url),{signal});
 const payload=await response.json();if(!response.ok||payload.error)throw Error(payload.error||`Plan source HTTP ${response.status}`);
 const plan=normalizeDearCongressPlan(payload,{sourceUrl:payload.sourceUrl,retrievedAt:payload.retrievedAt,packageId:packageId||payload.packageId||'A'});
 plan.provenance.snapshotId=payload.snapshotId||null;plan.provenance.sourceMode=payload.sourceMode;plan.provenance.sourceEndpoint=payload.sourceEndpoint;
 return{plan:checkPlan(plan),source:payload};
}
export function constitutionLocationQuery(search=location.search){
 const query=new URLSearchParams(search),result=new URLSearchParams();
 for(const[key,min,max]of[['lat',-90,90],['lng',-180,180]]){const raw=query.get(key),value=Number(raw);if(raw!==null&&Number.isFinite(value)&&value>=min&&value<=max)result.set(key,String(value));}
 const seed=Number(query.get('seed'));if(query.has('seed')&&Number.isInteger(seed)&&seed>=0&&seed<=4294967295)result.set('seed',String(seed));
 return result;
}
