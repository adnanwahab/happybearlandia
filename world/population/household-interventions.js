import {cashFlowIndicators} from './household-risk.js';

export const DEFAULT_INTERVENTIONS=Object.freeze({rentReductionPct:20,childcareSubsidyPct:50,wageIncreasePct:10,horizonDays:30});

/** A counterfactual calculator over recorded payments. Never mutates model state. */
export function compareHouseholdInterventions(risk,options={}){
 const controls={...DEFAULT_INTERVENTIONS,...options};
 for(const key of ['rentReductionPct','childcareSubsidyPct','wageIncreasePct']){
  if(!Number.isFinite(controls[key])||controls[key]<0||controls[key]>100)throw new Error('Percentages must be between 0 and 100.');
 }
 if(!Number.isInteger(controls.horizonDays)||controls.horizonDays<1||controls.horizonDays>365)throw new Error('Use a whole projection period from 1 to 365 days.');
 const unavailable=reason=>({available:false,reason,controls});
 if(!risk?.sufficient)return unavailable(risk?.reason||'Seven consecutive, complete payment days are required.');
 const {savings,meanDailyIncome:income,meanDailySpending:spending,meanDailyWages:wages,meanDailyRent:rent,meanDailyChildcare:childcare}=risk;
 if(![savings,income,spending,wages,rent,childcare].every(Number.isFinite))return unavailable('The recorded wage, rent and childcare breakdown is incomplete.');
 if([income,spending,wages,rent,childcare].some(n=>n<0)||wages>income+.01||rent+childcare>spending+.01)return unavailable('The recorded payment breakdown does not reconcile with income and expenses.');
 const wageGain=wages*(controls.wageIncreasePct/100),rentRelief=rent*(controls.rentReductionPct/100),careRelief=childcare*(controls.childcareSubsidyPct/100);
 function scenario(id,label,rentSaving=0,childcareSaving=0,extraWages=0){
  const benefit=rentSaving+childcareSaving+extraWages,metrics=cashFlowIndicators(savings,income+extraWages,Math.max(0,spending-rentSaving-childcareSaving));
  return{id,label,...metrics,canCoverExpenses:metrics.depletionState==='not-depleting',dailyBenefit:benefit,projectedSavings:savings+metrics.meanDailyNet*controls.horizonDays,addedResources:benefit*controls.horizonDays,costs:{publicSubsidy:childcareSaving*controls.horizonDays,employerPayrollIncrease:extraWages*controls.horizonDays,landlordRentForgone:rentSaving*controls.horizonDays}};
 }
 const scenarios=[scenario('baseline','Recorded baseline'),scenario('rent','Rent reduction',rentRelief),scenario('childcare','Childcare subsidy',0,careRelief),scenario('wages','Wage increase',0,0,wageGain),scenario('combined','Combined support',rentRelief,careRelief,wageGain)];
 return{schemaVersion:'household-interventions.v1',available:true,controls,asOfMinute:risk.asOfMinute??null,evidence:risk.evidence?{...risk.evidence}:null,baseline:{savings,income,spending,wages,rent,childcare},scenarios,remainingDailyGap:Math.max(0,-scenarios.at(-1).meanDailyNet),assumptions:['Average payments from the latest seven complete, reconciled days continue for the chosen horizon.','Rent relief reduces rent received by landlords; childcare support reimburses existing household-paid childcare; wage increases raise employer payroll.','Hours worked, employment, prices, demand, benefits and behavior remain constant. Household taxes, payroll taxes, administration and wider market effects are outside this calculator.','Percentage wage support applies to observed wages only; it creates no job or income for a household with no recorded wages.']};
}
