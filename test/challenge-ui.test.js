import {test,expect} from 'bun:test';
import {createCity} from '../world/city/seed.js';
import {createChallengeEnvelope} from '../world/challenges/contract.js';
import {defaultChallengeActions} from '../world/challenges/panel.js';
import {challengeLinkPayload,challengeFromLink} from '../world/challenges/transport.js';
test('challenge links retain frozen seed, geometry, cap and objective definitions through compression',async()=>{const initial=createCity({households:6,seed:42}),actions=defaultChallengeActions(initial),challenge=await createChallengeEnvelope({initialState:initial,budget:50000,months:12,actions,referenceSelection:['housing']});const payload=await challengeLinkPayload(challenge),decoded=await challengeFromLink(payload);expect(decoded).toEqual(challenge);expect(decoded.seed).toBe(42);expect(decoded.budget.metric).toBe('cumulativeCapitalExpense');expect(decoded.actions).toEqual(challenge.actions);await expect(challengeFromLink('bad-format')).rejects.toThrow();expect(initial.policies).toEqual([]);});
