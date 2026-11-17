import {createChallengeEnvelope, validateChallengeEnvelope, verifyChallenge} from './contract.js';
import {createCity} from '../city/seed.js';
export const RULE = 'city-bracket.v1: lowest sum of final unhoused households across all seeds; exact ties advance earlier submission; adjacent single elimination';
const freeze = value => { if(value && typeof value === 'object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value; };
export async function tournamentChallenges(){
 return Promise.all([42,73].map(seed=>createChallengeEnvelope({
  initialState:createCity({households:6,seed}),months:12,budget:5000,
  title:'Small city housing tournament',metrics:['unhousedHouseholds'],
  actions:[{id:'housing',label:'Build two homes',intervention:{type:'housing',districtId:'d0',amount:2,cost:1000}},
   {id:'transit',label:'Add transit capacity',intervention:{type:'transit',districtId:'d1',amount:10,cost:2000}}]
 })));
}
export function submitRecipe(entries, selection, consent){
 if(consent!==true)throw Error('Explicit local participation consent required.');
 if(entries.length>=4)throw Error('Bracket is full. Delete it to start another.');
 return freeze([...entries,{id:`plan-${entries.length+1}`,selection:structuredClone(selection),consent:true}]);
}
export async function runTournament(input){
 // Snapshot before the first await: callers cannot change a recipe mid-run.
 const recipe=structuredClone(input);
 if(JSON.stringify(recipe).length>2500000)throw Error('Bracket receipt exceeds 2.5 MB.');
 if(recipe.rule!==RULE||!Array.isArray(recipe.challenges)||recipe.challenges.length!==2||!Array.isArray(recipe.entries)||![2,4].includes(recipe.entries.length))throw Error('Require versioned rules, two frozen seeds and two or four submissions.');
 const challenges=[];
 for(const challenge of recipe.challenges)challenges.push(await validateChallengeEnvelope(challenge));
 const terms=c=>JSON.stringify([c.engineVersion,c.months,c.budget,c.actions,c.metrics,c.guards,c.referenceSelection]);
 if(challenges[0].seed===challenges[1].seed||terms(challenges[0])!==terms(challenges[1])||challenges[0].metrics.length!==1||challenges[0].metrics[0].id!=='unhousedHouseholds')throw Error('Unequal constraints or unsupported metrics; no winner inferred.');
 if(recipe.entries.some((e,i)=>e.id!==`plan-${i+1}`))throw Error('Submission ordering/identity mismatch.');
 const evaluations=[];
 for(const entry of recipe.entries){
  const row={id:entry.id,status:'eligible',reason:null,runs:[],score:0};
  if(entry.consent!==true){row.status='disqualified';row.reason='Participation consent missing.';}
  else for(const challenge of challenges){
   try{
    const run=await verifyChallenge(challenge,{selection:entry.selection});
    row.runs.push(run);
    if(!run.budget.referenceWithinCap)throw Error('Reference exceeds cap; challenge cannot be ranked.');
    if(run.status==='metrics-unavailable')throw Error('Metric observations missing; no winner inferred.');
    if(run.status==='ineligible'){row.status='disqualified';row.reason='Budget or frozen guard failed.';}
    row.score+=run.candidate.metrics[0].value;
   }catch(error){
    // Invalid selections are attributable to the recipe; execution/data failures block the bracket.
    if(!Array.isArray(entry.selection)||new Set(entry.selection).size!==entry.selection.length||entry.selection.some(id=>!challenge.actions.some(a=>a.id===id))){row.status='disqualified';row.reason=String(error.message);break;}
    throw error;
   }
  }
  if(row.status==='disqualified')row.score=null;
  evaluations.push(row);
 }
 const matches=[];let remaining=evaluations;
 while(remaining.length>1){const next=[];for(let i=0;i<remaining.length;i+=2){const a=remaining[i],b=remaining[i+1];let winner=null;
  if(a&&b){if(a.status==='eligible'&&b.status==='eligible')winner=a.score<=b.score?a:b;else winner=[a,b].find(e=>e.status==='eligible')??null;}
  else winner=a??b;
  matches.push({round:Math.log2(recipe.entries.length/remaining.length)+1,entrants:[a?.id??null,b?.id??null],winner:winner?.id??null,tie:!!a&&!!b&&a.status==='eligible'&&b.status==='eligible'&&a.score===b.score});next.push(winner);}
  remaining=next;
 }
 return freeze({schemaVersion:'city-bracket-receipt.v1',recipe,evaluations,matches,winner:remaining[0]?.id??null,provenance:'Synthetic City engine outputs; each run retains frozen initial hash, seed, metric source, full final state and monthly capital ledger. No authenticated identity or empirical fairness claim.'});
}
