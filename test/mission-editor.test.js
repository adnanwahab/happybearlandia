import {test,expect} from 'bun:test';
import {missionCheckpoint} from '../world/challenges/checkpoints.js';
import {defaultChallengeActions} from '../world/challenges/panel.js';
import {createChallengeEnvelope,verifyChallenge,CHALLENGE_METRICS} from '../world/challenges/contract.js';
import {challengeLinkPayload,challengeFromLink} from '../world/challenges/transport.js';
test('supported mission checkpoints are independent and refuse unknown identities',()=>{
 const a=missionCheckpoint('city-small-42.v1');a.households[0].income=0;
 expect(missionCheckpoint('city-small-42.v1').households[0].income).toBeGreaterThan(0);
 expect(missionCheckpoint('city-small-73.v1').seed).toBe(73);
 for(const id of ['missing','__proto__','',null])expect(()=>missionCheckpoint(id)).toThrow('unavailable');
});
test('each registered objective survives export and same-baseline seed replay without trusting scores',async()=>{
 for(const metric of Object.keys(CHALLENGE_METRICS)){
 const initialState=missionCheckpoint('city-small-73.v1');
 const card=await createChallengeEnvelope({initialState,actions:defaultChallengeActions(initialState),months:2,budget:20000,metrics:[metric]});
 const restored=await challengeFromLink(await challengeLinkPayload(card));
 expect(restored).toEqual(card);
 const first=await verifyChallenge(card,{selection:['transit']}),second=await verifyChallenge(restored,{selection:['transit']});
 const normalize=result=>({...result,guards:result.guards.toSorted((a,b)=>a.id.localeCompare(b.id))});expect(normalize(second)).toEqual(normalize(first));expect(first.reference.initialHash).toBe(first.candidate.initialHash);expect(first.candidate.seed).toBe(73);
 await expect(verifyChallenge(restored,{selection:[],score:100})).rejects.toThrow();
 }
});
test('empty, duplicate and invented mission objectives refuse',async()=>{
 const initialState=missionCheckpoint('city-small-42.v1');
 for(const metrics of [[],['happiness'],['employmentRate','employmentRate']])await expect(createChallengeEnvelope({initialState,budget:0,metrics})).rejects.toThrow('registered');
});
