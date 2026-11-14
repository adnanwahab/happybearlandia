/** Read-only, bounded cross-app law behavior receipt.
 * No screenshots, private entries, full city snapshots or arbitrary law-to-outcome inference.
 * Globally admitted by ops/security/simulation-admission.js at the server routing boundary.
 */
import {getLaw} from './catalog.js';
import {compareLaw} from './comparison.js';
import {pairedLawFrames} from './behavior-playback.js';

export const LAW_BEHAVIOR_RECEIPT_VERSION='hbl-law-behavior-receipt.v1';
export const LAW_BEHAVIOR_ALLOWED_ORIGINS=Object.freeze([
  'https://civic-synthesis.fly.dev','https://dear-congress.fly.dev','https://happybearlandia.fly.dev'
]);
const POP_METRICS=['trips','completedTrips','meanCommuteMinutes','meanExperiencedTravelMinutes','deniedBoardings','employmentRate','meanHousingBurden','modeledUtility','activeTrips','moves','businessRevenue','transitCrowding'];
const CITY_METRICS=['entitledCapacity','housingUnits','availableUnits','meanRent','meanRentBurden','meanSavings','jobs','employmentRate','completedProjects','balance','debt','meanTripMinutes'];
const POP_FIELDS=['id','label','activity','mode','commuteMinutes','employmentStatus','homeDistrictId','workDistrictId','x','z'];
const CITY_FIELDS=['id','label','districtId','unitId','monthlyIncome','monthlyRent','savings','unhoused'];
const finite=Number.isFinite;
const boundNumber=(value,min,max)=>typeof value==='number'&&finite(value)&&value>=min&&value<=max;
const boundInteger=(value,min,max)=>Number.isInteger(value)&&value>=min&&value<=max;
export function allowedLawBehaviorOrigin(origin){
  if(!origin)return true; // non-browser same-origin clients; still subject to IP admission.
  if(LAW_BEHAVIOR_ALLOWED_ORIGINS.includes(origin))return true;
  try{
    const u=new URL(origin);
    return u.origin===origin&&u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname);
  }catch{return false;}
}
function corsHeaders(origin){
  return origin?{
    'access-control-allow-origin':origin,'access-control-allow-methods':'POST, OPTIONS',
    'access-control-allow-headers':'content-type','access-control-max-age':'600','vary':'Origin'
  }:{};
}
function pick(row,fields){
  if(!row||typeof row!=='object')return{};
  const out={};
  for(const key of fields){
    const v=row[key];
    if(typeof v==='string'&&v.length<=120||typeof v==='boolean'||finite(v)||v===null)out[key]=v;
  }
  return out;
}
function metrics(row,engine){
  const fields=engine==='city'?CITY_METRICS:POP_METRICS;
  const out={};
  for(const key of fields)if(finite(row?.[key]))out[key]=row[key];
  return out;
}
function actors(rows,engine){
  const fields=engine==='city'?CITY_FIELDS:POP_FIELDS;
  return rows.slice(0,12).filter(row=>typeof row?.id==='string'&&row.id.length<=90)
    .map(row=>pick(row,fields));
}
export function lawBehaviorReceipt(result,law){
  const frames=pairedLawFrames(result),engine=result?.engine;
  if(result?.status!=='completed'||!frames.length)return{
    schemaVersion:LAW_BEHAVIOR_RECEIPT_VERSION,status:'mechanism-unavailable',
    law:{id:law.id,number:law.number,title:law.title},
    reason:result?.reason||'No completed paired model timeline is available.',
    frames:[],manifest:null,
    limitations:['No modeled effects supplied for this law. No prediction is generated.']
  };
  const m=result.manifest||{},unit=frames[0].unit;
  return{
    schemaVersion:LAW_BEHAVIOR_RECEIPT_VERSION,status:'completed',
    law:{id:law.id,number:law.number,title:law.title},
    engine,unit,
    manifest:{modelVersion:m.modelVersion??null,seed:m.seed,population:m.population,
      implementationStrength:m.implementationStrength??1,pairedInitialState:true,
      start:frames[0].time,end:frames.at(-1).time,recordedCheckpoints:frames.length,
      scope:'fixed synthetic world; not linked to the caller’s policy package'},
    frames:frames.map(frame=>({
      time:frame.time,
      baseline:{metrics:metrics(frame.baseline,engine),actors:actors(frame.baselineActors,engine)},
      edited:{metrics:metrics(frame.treatment,engine),actors:actors(frame.treatmentActors,engine)}
    })),
    limitations:[
      'Both worlds share the same synthetic initial state, seed and exact horizon.',
      'At most 12 fixed-index synthetic actor records per checkpoint, not a representative sample.',
      'Only execution-reviewed model parameters drive differences; this does not apply arbitrary edited policy text.',
      'Not calibrated to predict real-world behavior, welfare, budgets, public support or legal compliance.',
      'No unsampled actor trajectories, inferred intermediate values, private user journals or recorded real identities.'
    ]
  };
}
export function createLawBehaviorHandler({compare=compareLaw,maxConcurrent=3}={}){
  let active=0;
  return async function handleLawBehavior(request){
    const origin=request.headers.get('origin');
    if(!allowedLawBehaviorOrigin(origin))return Response.json({error:'Origin not allowed.'},{status:403,headers:{'cache-control':'no-store'}});
    const headers={...corsHeaders(origin),'cache-control':'no-store'};
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(request.method!=='POST')return Response.json({error:'Use POST.'},{status:405,headers:{...headers,allow:'POST, OPTIONS'}});
    const length=Number(request.headers.get('content-length')||0);
    if(length>1024)return Response.json({error:'Input too large.'},{status:413,headers});
    let raw,input;
    try{raw=await request.text();}
    catch{return Response.json({error:'Could not read input.'},{status:400,headers});}
    if(raw.length>1024)return Response.json({error:'Input too large.'},{status:413,headers});
    try{input=JSON.parse(raw);}
    catch{return Response.json({error:'Invalid bounded JSON input.'},{status:400,headers});}
    if(!input||typeof input!=='object'||Array.isArray(input)||
      !boundInteger(input.lawId,11,100)||!boundInteger(input.seed,0,0xffffffff)||
      !boundInteger(input.population,1,60)||
      !boundNumber(input.implementationStrength,0,1))
      return Response.json({error:'Use lawId 11–100, integer seed 0–4294967295, population 1–60 and strength 0–1.'},{status:400,headers});
    const law=getLaw(input.lawId);
    if(!law)return Response.json({error:'Law not found.'},{status:404,headers});
    if(input.implementationStrength!==1&&!(law.supported&&
      Object.keys(law.mapping?.parameterFactors||{}).length&&
      !law.mapping?.intervention&&!Object.keys(law.mapping?.parameterPatch||{}).length))
      return Response.json({error:'Partial strength is not supported for this fixed or unavailable law.'},{status:422,headers});
    if(active>=maxConcurrent)return Response.json({error:'Model is busy; please retry this limited experiment.'},{status:503,headers:{...headers,'retry-after':'5'}});
    active++;
    try{
      // The engine chooses exact bounded 12-hour or 12-month horizons. Callers cannot request arbitrary worlds/workloads.
      const result=await compare({lawId:law.number,seed:input.seed,population:input.population,
        implementationStrength:input.implementationStrength,
        ...(law.mapping?.engine==='city'?{months:12}:{minutes:720}),
        signal:request.signal});
      return Response.json(lawBehaviorReceipt(result,law),{status:200,headers});
    }catch(error){
      if(error?.name==='AbortError')return Response.json({error:'Cancelled.'},{status:409,headers});
      return Response.json({error:'Law comparison unavailable. Check reviewed mapping, input validity and model availability.'},{status:422,headers});
    }finally{active--;}
  };
}
