import {compactSettlement,RISK_WINDOW_DAYS} from './household-risk.js';
/** One latest settlement per household. Durable history is assembled from collected snapshots. */
export function accrueMoneySource(model,h,personIndex,businessId,category,amount){
 if(!(amount>0))return;
 const state=model.moneyHistory??={pending:{},latest:{}};
 const sources=state.pending[h]??={},personId=`${model.prefix}-p${personIndex}`,key=`${personId}:${businessId||''}:${category}`;
 let source=sources[key];
 if(!source){
  const business=businessId?model.economy.businesses.find(b=>b.id===businessId):null;
  source=sources[key]={personId,businessId,category,amount:0,person:{id:personId,householdId:`${model.prefix}-h${h}`,annualContractWage:model.people.income[personIndex]},business:business?{id:business.id,type:business.type,districtId:model.districts[business.district].id}:null};
 }
 source.amount+=amount;
}
export function settleMoneyHistory(model,h,{openingSavings,dailyIncome,earned,food,utilities,other,transport,childcare}){
 const state=model.moneyHistory??={pending:{},latest:{}},hh=model.households,householdId=`${model.prefix}-h${h}`;
 const sources=Object.values(state.pending[h]||{});delete state.pending[h];
 const entries=[{category:'wages',amount:earned.wages},{category:'benefits',amount:earned.benefits},{category:'other_income',amount:dailyIncome-earned.wages-earned.benefits},{category:'rent',amount:-hh.rent[h]/30},{category:'food',amount:-food/30},{category:'utilities',amount:-utilities/30},{category:'other_spending',amount:-other/30},{category:'transport',amount:-transport},{category:'childcare',amount:-childcare}];
 const previous=state.latest[h];
 state.latest[h]={periodStartMinute:previous?.minute??model.provenance?.initialization?.initialMinute??Math.max(0,model.minute-1440),id:`${householdId}:settlement:${model.minute}`,householdId,tick:model.tick,minute:model.minute,openingSavings,closingSavings:hh.savings[h],entries,sources,memberIds:[],events:[]};
 state.recent??={};const recent=state.recent[h]??=[];recent.push(compactSettlement(state.latest[h]));if(recent.length>RISK_WINDOW_DAYS)recent.shift();
}
export function recordMovingPayment(model,h,amount){const record=model.moneyHistory?.latest[h];if(record&&record.minute===model.minute){record.entries.push({category:'moving',amount:-amount});record.closingSavings=model.households.savings[h];const recent=model.moneyHistory.recent?.[h];if(recent?.length)recent[recent.length-1]=compactSettlement(record);}}
export function householdMoneyHistory(model,h,memberIds){const record=model.moneyHistory?.latest[h];if(!record)return null;const ids=new Set(memberIds);return{...structuredClone(record),memberIds,events:structuredClone(model.events.filter(e=>e.minute>=record.minute-1440&&e.minute<=record.minute&&(e.householdId===record.householdId||ids.has(e.personId)))),taxesModeled:false,units:'USD per synthetic household; not multiplied by represented-population weight',expenseBasis:'Rent, food, utilities and other spending are daily budget charges; transport and childcare are accrued costs. No merchant or landlord is assigned to these charges.'};}
