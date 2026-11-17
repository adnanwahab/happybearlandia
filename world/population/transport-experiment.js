/** Research-only hooks. Absent controls preserve ordinary arithmetic exactly.
 * These controls ablate transport demand, NOT all resident interaction.
 * Reattach from the recipe on regeneration; live checkpoints are unsupported.
 */
const controls=new WeakMap();
export const TRANSPORT_ARMS=Object.freeze(['full','frozen-transport','shuffled-transport','half-transport','double-transport']);
export const TRANSPORT_RULES='transport-demand-ablation.v1';
export function attachTransportExperiment(model,arm,observer=null){
 if(!TRANSPORT_ARMS.includes(arm))throw Error('Unknown transport arm');
 if(model.minute!==0||model.tick!==0||controls.has(model))throw Error('Attach once to fresh midnight model');
 const n=model.districts.length;
 controls.set(model,{arm,observer,scale:arm==='half-transport'?.5:arm==='double-transport'?2:1,
  frozen:model.districts.map(d=>({congestion:d.congestion,transitCrowding:d.transitCrowding,transitDemand:d.transitDemand})),
  sources:Array.from({length:n},(_,i)=>i)});
}
export function transportControl(model){return controls.get(model);}
// Fisher-Yates uses a separate RNG stream: no resident choice draws consumed.
export function transportPermutation(length,seed,minute){
 const rows=Array.from({length},(_,i)=>i);let random=(seed^Math.imul(minute+1,2654435761))>>>0;
 const next=()=>random=(Math.imul(random,1664525)+1013904223)>>>0;
 for(let i=length-1;i>0;i--){const j=next()%(i+1);[rows[i],rows[j]]=[rows[j],rows[i]];}
 return rows;
}
export function beginTransportInterval(model,start){
 const c=controls.get(model);if(c?.arm==='shuffled-transport')c.sources=transportPermutation(model.districts.length,model.seed,start);
}
export function transportRead(model,district,key){
 const c=controls.get(model);if(!c||c.arm==='full')return model.districts[district][key];
 if(c.arm==='frozen-transport')return c.frozen[district][key];
 const value=model.districts[c.sources[district]][key];
 // Congestion has a free-flow baseline of 1; crowding/demand have baseline 0.
 return key==='congestion'?1+(value-1)*c.scale:value*c.scale;
}

export function observeTransportInterval(model,start,end){controls.get(model)?.observer?.interval(model,start,end);}
export function observeTransportDeparture(model,i,plan,best,time){controls.get(model)?.observer?.departure(model,i,plan,best,time);}
