import {test,expect} from 'bun:test';
import {createCity} from '../world/city/seed.js';
import {createChallengeEnvelope} from '../world/challenges/contract.js';
import {defaultChallengeActions} from '../world/challenges/panel.js';
import {challengeLinkPayload,challengeFromLink} from '../world/challenges/transport.js';
test('challenge links retain frozen seed, geometry, cap and objective definitions through compression',async()=>{const initial=createCity({households:6,seed:42}),actions=defaultChallengeActions(initial),challenge=await createChallengeEnvelope({initialState:initial,budget:50000,months:12,actions,referenceSelection:['housing']});const payload=await challengeLinkPayload(challenge),decoded=await challengeFromLink(payload);expect(decoded).toEqual(challenge);expect(decoded.seed).toBe(42);expect(decoded.budget.metric).toBe('cumulativeCapitalExpense');expect(decoded.actions).toEqual(challenge.actions);await expect(challengeFromLink('bad-format')).rejects.toThrow();expect(initial.policies).toEqual([]);});

test('district policy menu has three bounded alternatives and an enforceable allocation cap',async()=>{
 const {selectedCapitalBudget}=await import('../world/challenges/panel.js');
 const state=createCity({households:6,seed:42}),actions=defaultChallengeActions(state);
 expect(actions).toHaveLength(3);expect(actions.every(a=>a.intervention.districtId===state.districts[0].id)).toBe(true);
 expect(selectedCapitalBudget(actions,['housing','transit'],20000)).toEqual({committed:20000,remaining:0,withinCap:true});
 expect(selectedCapitalBudget(actions,actions.map(a=>a.id),20000).withinCap).toBe(false);
 expect(selectedCapitalBudget(actions,[],0).withinCap).toBe(true);
 for(const cap of [NaN,Infinity,-1,1e13])expect(()=>selectedCapitalBudget(actions,[],cap)).toThrow();
 expect(()=>selectedCapitalBudget(actions,['housing','housing'],20000)).toThrow();
 expect(()=>selectedCapitalBudget(actions,['unknown'],20000)).toThrow();
});

test('each district policy replays deterministically against an unchanged same-seed control',async()=>{
 const {verifyChallenge}=await import('../world/challenges/contract.js');
 const initial=createCity({households:6,seed:42}),before=JSON.stringify(initial),actions=defaultChallengeActions(initial);
 const envelope=await createChallengeEnvelope({initialState:initial,months:12,budget:20000,actions,referenceSelection:[],metrics:['unhousedHouseholds','meanExperiencedCommuteMinutes']});
 for(const action of actions){
  const first=await verifyChallenge(envelope,{selection:[action.id]}),second=await verifyChallenge(envelope,{selection:[action.id]});
  expect(first).toEqual(second);expect(first.reference.initialHash).toBe(first.candidate.initialHash);expect(first.reference.seed).toBe(42);expect(first.candidate.seed).toBe(42);
  expect(first.metrics.every(row=>row.delta===null||Number.isFinite(row.delta))).toBe(true);
 }
 expect(JSON.stringify(initial)).toBe(before);
});
