import {validateChallengeEnvelope,verifyChallenge} from './contract.js';
export const SPEEDRUN_RULE='change-one-thing.v1';
export const SPEEDRUN_DIGEST='e786404a9d355c702d97183622847c355b102e9765f24a8faf5d7404067936ed';
export async function speedrunScenario(){
 const {default:pinned}=await import('./fixtures/speedrun-v1.json',{with:{type:'json'}});
 const envelope=await validateChallengeEnvelope(structuredClone(pinned));
 if(envelope.digest!==SPEEDRUN_DIGEST)throw Error('Pinned scenario mismatch.');
 return envelope;
}

// No submitted outcomes are accepted. Both pairs are executed from the pinned
// checkpoint, then compared in full before deriving a normalized score.
export async function runSpeedrun(input,selection,options={}){
 const chosen=structuredClone(selection);
 const envelope=await validateChallengeEnvelope(input);
 if(envelope.digest!==SPEEDRUN_DIGEST)throw Error('Pinned scenario mismatch; no placement.');
 if(!Array.isArray(chosen)||chosen.length!==1||!envelope.actions.some(a=>a.id===chosen[0]))throw Error('Choose exactly one supported decision.');
 const first=await verifyChallenge(envelope,{selection:chosen},options);
 const replay=await verifyChallenge(envelope,{selection:chosen},options);
 assertMatchingReplay(first,replay);
 const metric=first.metrics[0];
 if(!metric||metric.status!=='available'||!Number.isFinite(metric.reference)||!Number.isFinite(metric.candidate))throw Error('Source observations unavailable; no score or placement.');
 if(first.status==='ineligible'||first.status==='metrics-unavailable')throw Error('Run ineligible or missing evidence; no score or placement.');
 // Fixed denominator: six starting synthetic households, never elapsed time.
 const score=Math.round(100*Math.max(0,Math.min(1,(metric.reference-metric.candidate)/6)));
 return {schemaVersion:SPEEDRUN_RULE,scenarioDigest:envelope.digest,rule:'round(100 * clamp((reference unhoused - candidate unhoused) / 6, 0, 1))',score,success:first.won,placement:first.won?1:null,scope:'This attempt only; no global leaderboard',selection:chosen,result:first,replayVerified:true};
}

export function assertMatchingReplay(first,replay){
 if(!first||!replay)throw Error('Missing run; no score or placement.');
 if(JSON.stringify(first)!==JSON.stringify(replay))throw Error('Replay mismatch; no score or placement.');
}

export function decisionTimer(now=()=>performance.now()){
 let elapsed=0,start=null;
 return {reset(){elapsed=0;start=null;},resume(){if(start===null)start=now();},pause(){if(start!==null){elapsed+=Math.max(0,now()-start);start=null;}},milliseconds(){return elapsed+(start===null?0:Math.max(0,now()-start));},get running(){return start!==null;}};
}
