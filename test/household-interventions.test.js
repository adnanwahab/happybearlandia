import {createPopulationModel,stepPopulation,snapshotPopulation,serializePopulation} from '../world/population/model.js';
import {test,expect} from 'bun:test';
import {analyzeHouseholdRisk} from '../world/population/household-risk.js';
import {compareHouseholdInterventions} from '../world/population/household-interventions.js';
function baseline({wages=100,benefits=0,rent=70,food=30,childcare=20,savings=1000,days=7}={}){
 let balance=savings;const records=Array.from({length:days},(_,day)=>{const entries=[{category:'wages',amount:wages},{category:'benefits',amount:benefits},{category:'rent',amount:-rent},{category:'food',amount:-food},{category:'childcare',amount:-childcare}],openingSavings=balance;balance+=entries.reduce((sum,e)=>sum+e.amount,0);return{minute:(day+1)*1440,periodStartMinute:day*1440,openingSavings,closingSavings:balance,entries};});return analyzeHouseholdRisk(records);
}
test('interventions conserve resources across household support and each payer without mutating evidence',()=>{
 const risk=baseline(),before=structuredClone(risk),options={rentReductionPct:20,childcareSubsidyPct:50,wageIncreasePct:10,horizonDays:30},result=compareHouseholdInterventions(risk,options);
 expect(result.available).toBe(true);expect(result.baseline.savings).toBe(860);expect(result.evidence).toEqual({startMinute:0,endMinute:10080,days:7});
 const byId=Object.fromEntries(result.scenarios.map(s=>[s.id,s]));expect(byId.baseline.meanDailyNet).toBe(-20);expect(byId.rent.meanDailyNet).toBe(-6);expect(byId.childcare.meanDailyNet).toBe(-10);expect(byId.wages.meanDailyNet).toBe(-10);expect(byId.combined.meanDailyNet).toBe(14);expect(byId.combined.projectedSavings).toBe(1280);expect(byId.combined.depletionState).toBe('not-depleting');expect(byId.combined.canCoverExpenses).toBe(true);
 expect(byId.combined.costs).toEqual({publicSubsidy:300,employerPayrollIncrease:300,landlordRentForgone:420});expect(byId.combined.addedResources).toBe(1020);
 for(const row of result.scenarios){expect(Object.values(row.costs).reduce((sum,n)=>sum+n,0)).toBeCloseTo(row.addedResources,8);expect(row.projectedSavings-byId.baseline.projectedSavings).toBeCloseTo(row.addedResources,8)}
 expect(risk).toEqual(before);expect(options).toEqual({rentReductionPct:20,childcareSubsidyPct:50,wageIncreasePct:10,horizonDays:30});
});
test('zero scenarios reproduce baseline; fully covered costs are capped to recorded expenses',()=>{
 const risk=baseline(),zero=compareHouseholdInterventions(risk,{rentReductionPct:0,childcareSubsidyPct:0,wageIncreasePct:0}).scenarios;
 for(const row of zero)expect(row.meanDailyNet).toBe(risk.meanDailyNet);
 const full=compareHouseholdInterventions(risk,{rentReductionPct:100,childcareSubsidyPct:100,wageIncreasePct:0,horizonDays:90}).scenarios.at(-1);expect(full.meanDailySpending).toBe(30);expect(full.costs.publicSubsidy).toBe(1800);expect(full.costs.landlordRentForgone).toBe(6300);
});
test('no wages or childcare create no invented income, public cost or jobs',()=>{
 const risk=baseline({wages:0,benefits:30,rent:30,food:10,childcare:0});const result=compareHouseholdInterventions(risk,{wageIncreasePct:100,childcareSubsidyPct:100,rentReductionPct:0});const row=result.scenarios.at(-1);expect(row.meanDailyIncome).toBe(30);expect(row.dailyBenefit).toBe(0);expect(row.costs.publicSubsidy).toBe(0);expect(row.costs.employerPayrollIncrease).toBe(0);expect(result.remainingDailyGap).toBe(10);
});
test('short, missing or inconsistent evidence cannot generate projections; controls reject invalid amounts',()=>{
 expect(compareHouseholdInterventions(baseline({days:6})).available).toBe(false);expect(compareHouseholdInterventions({...baseline(),meanDailyRent:null}).available).toBe(false);expect(compareHouseholdInterventions({...baseline(),meanDailyChildcare:1000}).available).toBe(false);
 for(const options of [{rentReductionPct:-1},{childcareSubsidyPct:101},{wageIncreasePct:NaN},{horizonDays:0},{horizonDays:366},{horizonDays:1.5}])expect(()=>compareHouseholdInterventions(baseline(),options)).toThrow();
});
test('depleted balances remain negative until support actually covers the deficit',()=>{
 const result=compareHouseholdInterventions(baseline({savings:0}),{rentReductionPct:0,childcareSubsidyPct:0,wageIncreasePct:0});const row=result.scenarios.at(-1);expect(row.depletionDays).toBe(0);expect(row.projectedSavings).toBe(-740);expect(row.canCoverExpenses).toBe(false);expect(result.remainingDailyGap).toBe(20);
});

test('live worker model summaries provide the same usable intervention evidence without stepping or charging households',()=>{
 const model=createPopulationModel({population:10});for(let day=1;day<=7;day++)stepPopulation(model,{tick:day,minutes:1440});const snapshot=snapshotPopulation(model),before=serializePopulation(model);
 for(const household of snapshot.households){const result=compareHouseholdInterventions(household.financialRisk);expect(result.available).toBe(true);expect(result.scenarios[0].meanDailyNet).toBeCloseTo(household.financialRisk.meanDailyNet,8);expect(result.baseline.savings).toBe(household.savings);}
 expect(serializePopulation(model)).toEqual(before);
});
test('small deficits are not falsely described as covering expenses',()=>{
 const deficit=compareHouseholdInterventions(baseline({wages:100,rent:100.005,food:0,childcare:0}),{rentReductionPct:0,childcareSubsidyPct:0,wageIncreasePct:0});expect(deficit.scenarios.at(-1).canCoverExpenses).toBe(false);expect(deficit.remainingDailyGap).toBeCloseTo(.005,9);
 const even=compareHouseholdInterventions(baseline({wages:100,rent:100,food:0,childcare:0}),{rentReductionPct:0,childcareSubsidyPct:0,wageIncreasePct:0});expect(even.scenarios.at(-1).canCoverExpenses).toBe(true);
});
