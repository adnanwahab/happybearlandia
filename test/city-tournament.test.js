import {test,expect} from 'bun:test';
import {RULE,tournamentChallenges,submitRecipe,runTournament} from '../world/challenges/tournament.js';
const recipe=async()=>({rule:RULE,challenges:await tournamentChallenges(),entries:submitRecipe(submitRecipe([],[],true),['housing'],true)});
test('complete pinned bracket independently reruns; tampered outcome numbers never enter scoring',async()=>{
 const input=await recipe(),before=JSON.stringify(input),a=await runTournament(input),b=await runTournament(JSON.parse(before));
 expect(a).toEqual(b);expect(JSON.stringify(input)).toBe(before);expect(a.evaluations).toHaveLength(2);expect(a.winner).toBeTruthy();
 for(const row of a.evaluations)for(const [i,run] of row.runs.entries()){expect(run.candidate.seed).toBe(input.challenges[i].seed);expect(run.candidate.initialHash).toBe(input.challenges[i].initialHash);expect(run.candidate.capitalLedger).toHaveLength(12);}
 await Bun.write('docs/reviews/SHE-775-receipt.json',JSON.stringify({command:'bun test test/city-tournament.test.js',receipt:a},null,2));
});
test('consent, immutable selections, invalid plans and tie rule',async()=>{
 expect(()=>submitRecipe([],[],false)).toThrow('consent');const selection=['housing'],entries=submitRecipe([],selection,true);selection.push('transit');expect(entries[0].selection).toEqual(['housing']);expect(Object.isFrozen(entries[0].selection)).toBe(true);
 const input=await recipe();input.entries=[{id:'plan-1',selection:['unknown'],consent:true},{id:'plan-2',selection:[],consent:true}];const r=await runTournament(input);expect(r.evaluations[0].status).toBe('disqualified');expect(r.evaluations[0].reason).toContain('unique frozen');expect(r.winner).toBe('plan-2');
 input.entries=Array.from({length:4},(_,i)=>({id:`plan-${i+1}`,selection:[],consent:true}));const tied=await runTournament(input);expect(tied.matches).toHaveLength(3);expect(tied.winner).toBe('plan-1');expect(tied.matches.every(m=>m.tie)).toBe(true);
 input.entries.forEach(e=>e.consent=false);expect((await runTournament(input)).winner).toBeNull();
});
test('missing/tampered seed data and unequal constraints refuse a winner',async()=>{
 const input=await recipe();input.challenges[1]=input.challenges[0];await expect(runTournament(input)).rejects.toThrow('Unequal');
 const missing=structuredClone(await recipe());missing.challenges[1].initialState=null;await expect(runTournament(missing)).rejects.toThrow();
 const wrong=await recipe();wrong.rule='invented';await expect(runTournament(wrong)).rejects.toThrow('versioned');
});
