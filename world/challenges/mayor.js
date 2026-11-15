import {createCity} from '../city/seed.js';
import {createChallengeEnvelope} from './contract.js';
import {selectedCapitalBudget} from './panel.js';

export const MAYOR_VERSION = 'mayor-guide.v1';
export const MAYOR_BUDGET = 25000;
// Authored synthetic costs/amounts: game assumptions, not empirical estimates.
export const MAYOR_DECISIONS = [
  {id:'housing', title:'Homes versus capital', note:'Construction needs labor and utilities; completed homes may still be unaffordable.', options:[
    {id:'homes-small',label:'Build two homes',type:'housing',amount:2,cost:6000},
    {id:'homes-large',label:'Build six homes',type:'housing',amount:6,cost:18000}]},
  {id:'transit', title:'Mobility versus operating costs', note:'Transit capacity adds recurring operating expense outside this capital cap; routes may not improve.', options:[
    {id:'transit-small',label:'Add 10 transit capacity',type:'transit',amount:10,cost:4000},
    {id:'transit-large',label:'Add 30 transit capacity',type:'transit',amount:30,cost:12000}]},
  {id:'resilience', title:'Preparedness versus immediate results', note:'Protection competes with homes and transit. Without a modeled flood, it may not change the scored outcomes.', options:[
    {id:'protection-small',label:'Add 0.1 district resilience',type:'resilience',amount:.1,cost:5000},
    {id:'protection-large',label:'Add 0.3 district resilience',type:'resilience',amount:.3,cost:15000}]}
];
export async function createMayorChallenge(initialState=createCity({households:30,seed:42})) {
  const districtId=initialState.districts[0]?.id;
  if(!districtId)throw Error('Mayor challenge city has no district.');
  return createChallengeEnvelope({initialState,months:12,budget:MAYOR_BUDGET,title:'Five-minute mayor',
    actions:MAYOR_DECISIONS.flatMap(d=>d.options.map(o=>({id:o.id,label:o.label,intervention:{type:o.type,districtId,amount:o.amount,cost:o.cost}}))),
    referenceSelection:[],metrics:['unhousedHouseholds','meanExperiencedCommuteMinutes']});
}
export function mayorAllocation(envelope,selection) {
  if(!Array.isArray(selection)||selection.length!==3||!MAYOR_DECISIONS.every(d=>d.options.filter(o=>selection.includes(o.id)).length===1))
    throw Error('Choose one intervention in each of the three decisions.');
  return selectedCapitalBudget(envelope.actions,selection,envelope.budget.cap);
}
// Wall time only. Pausing, disabling or expiry never changes a run or verdict.
export function createMayorTimer(now=()=>performance.now()) {
  let remaining=300000,started=null;
  const read=()=>Math.max(0,remaining-(started===null?0:Math.max(0,now()-started)));
  return {read,start(){if(started===null&&remaining>0)started=now();},pause(){remaining=read();started=null;},reset(){remaining=300000;started=null;}};
}
