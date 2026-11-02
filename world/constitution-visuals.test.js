import {test,expect} from 'bun:test';
import {resolveConstitutionPlan,constitutionGeometry} from './constitution-visuals.js';
import {compilePlan} from './planspec.js';
test('drainage fallback is explicit and unsupported text is rejected',()=>{expect(resolveConstitutionPlan(null,'Accelerate bayou drainage').fallback).toBe(true);expect(()=>resolveConstitutionPlan(null,'Paid vacation')).toThrow();});
test('synthesis freezes actual package and exposes unsupported proposals',()=>{const {plan,fallback}=resolveConstitutionPlan({packages:[{name:'Balanced',items:[{proposal:{id:'f_drainage'}},{proposal:{id:'paid_leave'}}]}]},'idea');expect(fallback).toBe(false);expect(plan.unsupported).toEqual(['paid_leave']);expect(constitutionGeometry(plan).map(s=>s.label)).toContain('Detention basin');});
test('only modeled physical adapters produce geometry',()=>{expect(constitutionGeometry({proposalIds:['paid_leave']})).toEqual([]);expect(constitutionGeometry(compilePlan(['t_brt','h_lots'])).length).toBe(8);});

test('stable API envelope containing upstream array resolves proposals',()=>{expect(resolveConstitutionPlan({synthesis:[{name:'Balanced',items:[{proposal:{id:'t_bus'}}]}]},'more buses').plan.actions[0].proposalId).toBe('t_bus');});
