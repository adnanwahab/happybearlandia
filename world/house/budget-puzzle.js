// Authored synthetic units, not observed household finances. No random draws.
export const BUDGET_VERSION = 'house-budget.v1';
export const BUDGET_SCENARIO = Object.freeze({id:'one-salary-seven-days.v1', seed:695, source:'authored-synthetic', salary:100, rent:40, rentDay:7, dailyFood:1, pantry:2});
export const BUDGET_ACTIONS = Object.freeze({
 groceries: Object.freeze({label:'Buy 3 food · 12 credits',cost:12,food:3}),
 takeaway: Object.freeze({label:'Buy 1 food · 9 credits',cost:9,food:1}),
 treat: Object.freeze({label:'Buy a treat · 15 credits',cost:15,food:0}),
 endDay: Object.freeze({label:'Finish day · consume 1 food',cost:0,food:0}),
});
function freeze(value){for(const child of Object.values(value))if(child&&typeof child==='object')freeze(child);return Object.freeze(value);}
export function startBudget(source=BUDGET_SCENARIO){
 if(!source)throw Error('No source scenario available. No result generated.');
 if(JSON.stringify(source)!==JSON.stringify(BUDGET_SCENARIO))throw Error('Scenario version mismatch. No result generated.');
 return freeze({version:BUDGET_VERSION,scenario:{...source},day:1,cash:source.salary,food:source.pantry,status:'playing',reason:'',actions:[],checkpoints:[]});
}
export function budgetStep(state,action){
 if(state.status!=='playing')throw Error('This week has ended. Restart to play again.');
 const rule=Object.hasOwn(BUDGET_ACTIONS,action)?BUDGET_ACTIONS[action]:null;
 if(!rule)throw Error('Unsupported action.');
 if(state.cash<rule.cost)throw Error('Not enough credits. Purchase rejected.');
 const next=structuredClone(state);next.cash-=rule.cost;next.food+=rule.food;
 next.actions.push(action);
 if(action==='endDay'){
  if(next.food<next.scenario.dailyFood){next.status='failed';next.reason='Daily food need unmet.';}
  else {next.food-=next.scenario.dailyFood;
   if(next.day===next.scenario.rentDay){if(next.cash<next.scenario.rent){next.status='failed';next.reason='Rent cannot be paid.';}else{next.cash-=next.scenario.rent;next.status='success';next.reason='Seven days fed and rent paid.';}}
  }
  next.checkpoints.push({id:`day-${next.day}`,parentId:next.checkpoints.at(-1)?.id??'start',day:next.day,cash:next.cash,food:next.food,status:next.status,actionCount:next.actions.length});
  if(next.status==='playing')next.day++;
 }
 return freeze(next);
}
export function cancelBudget(state){if(state.status!=='playing')return state;return freeze({...structuredClone(state),status:'cancelled',reason:'Week cancelled. No success or failure inferred.'});}
// Verify against retained evidence, never replace mismatched evidence with new results.
export function replayBudget(record){
 try{let state=startBudget(record.scenario);if(record.version!==BUDGET_VERSION||!Array.isArray(record.actions)||record.actions.length>1000)throw Error();
 for(const action of record.actions)state=budgetStep(state,action);
 if(record.status==='cancelled')state=cancelBudget(state);
 if(JSON.stringify(state)!==JSON.stringify(record))throw Error();return state;
 }catch{throw Error('Replay mismatch or missing evidence. No verified result available.');}
}
