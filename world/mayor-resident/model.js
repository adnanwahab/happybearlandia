// Authored synthetic budget exercise, independent of City and Population.
export const VERSION = 'mayor-resident.1.0.0';
export const INPUTS = Object.freeze({householdId:'exercise-household-1',seed:42,month:0,income:4000,rent:1800,expenses:1800,savings:2400});
export const POLICIES = Object.freeze({unchanged:0,voucher:300});
export const STRATEGIES = Object.freeze({usual:0,conserve:150});
export function runExercise(policy,strategy) {
  if(!Object.hasOwn(POLICIES,policy)||!Object.hasOwn(STRATEGIES,strategy))throw Error('Unsupported exercise choice');
  // Same exogenous expense in both arms; not an empirical distribution.
  const shock=((Math.imul(INPUTS.seed,1664525)+1013904223)>>>0)%101;
  const arm=(subsidy,saving)=>{const rent=INPUTS.rent-subsidy,expenses=INPUTS.expenses-saving+shock,balance=INPUTS.income-rent-expenses;return {month:1,rent,expenses,balance,savings:INPUTS.savings+balance,publicCost:subsidy};};
  const control=arm(0,STRATEGIES[strategy]),selected=arm(POLICIES[policy],STRATEGIES[strategy]);
  return {modelVersion:VERSION,rulesVersion:VERSION,checkpoint:'exercise-household-1:month-0',inputs:{...INPUTS},policy,strategy,shock,control,selected,deltaSavings:selected.savings-control.savings,success:selected.balance>=500,
    provenance:{classification:'authored synthetic assumptions',source:'world/mayor-resident/model.js',unit:'illustrative USD per modeled month',comparison:'Same checkpoint, seed, household strategy and expense draw; only policy differs',limitations:'No empirical calibration, housing allocation, wellbeing or City/Population identity mapping. Conserving assumes $150 lower spending without modeled welfare effects. Success is an authored $500 monthly balance target.'}};
}
