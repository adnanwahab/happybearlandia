// Independent authored toy: one reservation per crossing, no collision physics.
const freeze = value => { if(value && typeof value === 'object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value; };
export const VERSION='school-run.v1';
export const DEMO=freeze({version:VERSION,id:'synthetic-maple-morning.v1',seed:702,
 source:'authored synthetic fixture',school:'Maple Toy School (synthetic)',clock:'seconds after synthetic 08:00',
 crossings:['main','garden'],trips:Array.from({length:8},(_,i)=>({id:`pupil-${i+1}`,departure:0,walk:20,crossingSeconds:10,deadline:65}))});
export const PLANS=freeze({baseline:'Main crossing only',split:'Alternate pupils via garden crossing',detour:'All pupils via garden crossing'});
function validate(source){
 if(!source?.trips?.length)throw Error('No source trips available; no score.');
 // This bounded fixture intentionally refuses edits/imports rather than trusting a score or new rules.
 if(JSON.stringify(source)!==JSON.stringify(DEMO))throw Error('Replay mismatch: source fixture or version changed; no score.');
}
export function execute(source=DEMO,plan='baseline',{signal}={}){
 if(signal?.aborted)throw new DOMException('Cancelled; no score.','AbortError');
 validate(source);if(!Object.hasOwn(PLANS,plan))throw Error('Unsupported route adjustment.');
 const free={main:0,garden:0},previous={main:null,garden:null};
 const trips=source.trips.map((trip,i)=>{
  if(signal?.aborted)throw new DOMException('Cancelled; no score.','AbortError');
  const crossing=plan==='detour'||(plan==='split'&&i%2===1)?'garden':'main';
  // Garden has a synthetic 5-second extra approach; crossing service is exclusive.
  const approach=trip.walk+(crossing==='garden'?5:0),ready=trip.departure+approach;
  const start=Math.max(ready,free[crossing]),end=start+trip.crossingSeconds;
  const record={...trip,crossing,ready,start,end,delay:start-ready,late:end>trip.deadline,
   eventId:`${plan}:${trip.id}`,dependsOn:previous[crossing]};
  free[crossing]=end;previous[crossing]=record.eventId;return record;
 });
 return freeze({version:VERSION,scenarioId:source.id,seed:source.seed,plan,source:structuredClone(source),trips,
  totalDelay:trips.reduce((n,t)=>n+t.delay,0),late:trips.filter(t=>t.late).length});
}
export function compare(source=DEMO,plan='baseline',options={}){
 const baseline=execute(source,'baseline',options),candidate=execute(source,plan,options);
 return freeze({baseline,candidate,success:candidate.totalDelay<baseline.totalDelay&&candidate.late===0});
}
export function replay(record){
 const computed=execute(record?.source,record?.plan);
 if(JSON.stringify(computed)!==JSON.stringify(record))throw Error('Replay mismatch: recorded outcomes differ; no score.');
 return computed;
}
