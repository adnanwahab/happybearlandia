import {normalizeDearCongressPlan} from './plan.js';
export async function loadConstitutionSource({refresh=false,signal,packageId}={}){
 let response=await fetch('/api/constitution-city/plan',{method:refresh?'POST':'GET',signal});
 // Existing running dev servers can still serve the captured public snapshot.
 if(!refresh&&response.status===404)response=await fetch(new URL('./dear-congress-plan.json',import.meta.url),{signal});
 const payload=await response.json();if(!response.ok||payload.error)throw Error(payload.error||`Plan source HTTP ${response.status}`);
 const plan=normalizeDearCongressPlan(payload,{sourceUrl:payload.sourceUrl,retrievedAt:payload.retrievedAt,packageId:packageId||payload.packageId||'A'});
 plan.provenance.snapshotId=payload.snapshotId||null;plan.provenance.sourceMode=payload.sourceMode;plan.provenance.sourceEndpoint=payload.sourceEndpoint;
 return{plan,source:payload};
}
export function constitutionLocationQuery(search=location.search){
 const query=new URLSearchParams(search),result=new URLSearchParams();
 for(const[key,min,max]of[['lat',-90,90],['lng',-180,180]]){const raw=query.get(key),value=Number(raw);if(raw!==null&&Number.isFinite(value)&&value>=min&&value<=max)result.set(key,String(value));}
 const seed=Number(query.get('seed'));if(query.has('seed')&&Number.isInteger(seed)&&seed>=0&&seed<=4294967295)result.set('seed',String(seed));
 return result;
}
