import {mkdirSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID,randomInt} from 'node:crypto';
import {DEFAULT_RECIPE} from '../../world/future-machine/contracts.js';
import {initialForRecipe,normalizeReplay} from '../../world/future-machine/data/index.js';
import {stateHash} from '../../world/future-machine/data/core.js';
import {createEngine,addIntervention} from '../../world/city/engine.js';
import {buildEvidenceTrail} from '../../world/future-machine/story/evidence-trail.js';
import {createRunReceipt} from '../../world/future-machine/share/run-receipt.js';

// This module and its storage are outside every static asset root.
const decisions=[12,24,36,48].map(amount=>({label:`Authorize ${amount} homes in district d1 for $1,000,000`,recipe:{...DEFAULT_RECIPE,intervention:{...DEFAULT_RECIPE.intervention,amount}}}));
function run(initial,intervention){let state=structuredClone(initial);if(intervention)state=addIntervention(state,intervention);const steps=[],engine=createEngine();for(let i=0;i<120;i++){const step=engine.step(state);steps.push(step);state=step.state;}return normalizeReplay(initial,{steps});}
export function createDetectiveHandler({root=process.env.HBL_DETECTIVE_ROOT||'.hbl-detective'}={}){
  mkdirSync(root,{recursive:true});
  const path=join(root,'attempts.json');
  let records;try{records=JSON.parse(readFileSync(path,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;records={};}
  const save=()=>{writeFileSync(path+'.tmp',JSON.stringify(records),{mode:0o600});renameSync(path+'.tmp',path);};
  const cache=new Map();
  async function history(record){const key=record.caseIndex;if(cache.has(key))return cache.get(key);const recipe=record.recipe;const initial=initialForRecipe(recipe);const h={schemaVersion:recipe.schemaVersion,recipe,experimentId:null,initialHash:await stateHash(initial),modelVersion:recipe.modelVersion,seed:recipe.seed,baseline:run(initial),plan:run(initial,recipe.intervention),provenance:{...initial.provenance,modelManifest:createEngine().manifest,replay:'Deterministic recomputation; not independent checkpoint verification.'}};cache.set(key,h);return h;}
  const json=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store'}});
  const handle=async request=>{try{
    const url=new URL(request.url),parts=url.pathname.split('/').filter(Boolean).slice(2);
    if(parts.length===0&&request.method==='GET'){
      const attempts=Object.values(records),finished=attempts.filter(r=>r.reveal),supported=finished.filter(r=>r.reveal.completedWithEvidence);
      return json({started:attempts.length,submitted:finished.length,correct:finished.filter(r=>r.reveal.correct).length,completedWithTwoEvidenceSteps:supported.length,completionRate:attempts.length?supported.length/attempts.length:null,solvedWithoutEvidence:finished.filter(r=>r.reveal.correct&&r.reveal.evidenceSteps===0).length,unit:'saved attempts, not unique players',target:0.6});
    }
    if(parts.length===0&&request.method==='POST'){
      const body=await request.json();if(!Number.isInteger(body.caseIndex)||body.caseIndex<0||body.caseIndex>4)return json({error:'Choose a case from 1 to 5.'},400);
      if(Object.keys(records).length>=10000)return json({error:'Prototype capacity reached.'},503);
      const id=randomUUID(),answer=[1,3,0,2,1][body.caseIndex];
      const choices=decisions.map((d,index)=>({id:randomUUID(),index,label:d.label}));
      for(let i=choices.length-1;i>0;i--){const j=randomInt(i+1);[choices[i],choices[j]]=[choices[j],choices[i]];}
      records[id]={caseIndex:body.caseIndex,answer,choices,steps:[],recipe:{...decisions[answer].recipe,seed:42+body.caseIndex},createdAt:new Date().toISOString()};save();return json({experimentId:id},201);
    }
    const [id,action]=parts,r=records[id];if(!r||parts.length>2)return json({error:'Saved puzzle unavailable.'},404);
    const h=await history(r);
    if(!action&&request.method==='GET')return json({experimentId:id,caseNumber:r.caseIndex+1,month:120,outcome:{homes:h.plan[120].metrics.housingUnits,meanRent:h.plan[120].metrics.meanRent},choices:r.choices.map(({id,label})=>({id,label})),evidenceSteps:r.steps.length,reveal:r.reveal??null});
    if(action==='evidence'&&request.method==='POST'){
      const {step}=await request.json();if(!['inventory','completion','trail'].includes(step))return json({error:'Unknown evidence step.'},400);
      if(!r.reveal&&!r.steps.includes(step)){r.steps.push(step);save();}
      const completion=h.plan.flatMap(s=>s.events.filter(e=>e.eventType==='PROJECT_COMPLETE').map(e=>({month:s.month,eventId:e.id,homes:e.payload.units})));
      // Never serialize raw states, policies, projects, or event payloads before reveal.
      const building=h.plan[120].state.buildings.find(b=>!h.baseline[120].state.buildings.some(a=>a.id===b.id));
      const trail=building?buildEvidenceTrail(h,{collection:'buildings',id:building.id,month:120}):null;
      const evidence=step==='inventory'?{month:120,baselineHomes:h.baseline[120].metrics.housingUnits,hiddenFutureHomes:h.plan[120].metrics.housingUnits}:step==='completion'?{recordedCompletions:completion}: {nodes:trail?.nodes.map(n=>({type:n.type,arm:n.arm,month:n.month,status:n.status,unavailableReason:n.unavailableReason})),relationships:trail?.edges.map(e=>({relationship:e.relationship,status:e.status,causalClaim:false}))};
      return json({step,evidence,evidenceSteps:r.steps.length,limits:'Synthetic monthly City records. Recorded relationships do not independently verify causality.'});
    }
    if(action==='answer'&&request.method==='POST'){
      if(r.reveal)return json(r.reveal);
      const {choiceId}=await request.json(),choice=r.choices.find(c=>c.id===choiceId);if(!choice)return json({error:'Choose one of the four answers.'},400);
      const submitted={...decisions[choice.index].recipe,seed:h.seed},recipeHash=await stateHash(h.recipe),correct=await stateHash(submitted)===recipeHash;
      r.reveal={experimentId:id,correct,recipeHash,submittedRecipeHash:await stateHash(submitted),evidenceSteps:r.steps.length,score:correct?50+Math.min(r.steps.length,3)*15:0,completedWithEvidence:correct&&r.steps.length>=2,answer:decisions[r.answer].label,receipt:await createRunReceipt(h)};save();return json(r.reveal);
    }
    return json({error:'Unsupported method or action.'},405);
  }catch{return json({error:'Puzzle request failed. Retry or open a new case.'},400);}};
  // Serialize mutations across awaits so simultaneous reveals cannot overwrite a score.
  let pending=Promise.resolve();
  return request=>{const next=pending.then(()=>handle(request));pending=next.catch(()=>{});return next;};
}
