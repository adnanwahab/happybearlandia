import {test,expect} from 'bun:test';
import {analyzeHouseholdRisk,compactSettlement,modelHouseholdRisk} from '../world/population/household-risk.js';
import {createPopulationModel,stepPopulation,snapshotPopulation,serializePopulation,restorePopulation} from '../world/population/model.js';
import {visiblePopulationRows} from '../world/population/renderer.js';
export function riskRecords(days=14,{savings=3000,wages=100,rent=50,food=20,childcare=0,change={}}={}){
 let balance=savings;return Array.from({length:days},(_,i)=>{const values=i>=7?{wages,rent,food,childcare,...change}:{wages,rent,food,childcare},entries=Object.entries(values).map(([category,amount])=>({category,amount:category==='wages'?amount:-amount})),openingSavings=balance;balance+=entries.reduce((sum,e)=>sum+e.amount,0);return{id:`h:${i+1}`,householdId:'h',minute:(i+1)*1440,periodStartMinute:i*1440,openingSavings,closingSavings:balance,entries,sources:[],events:[]}});
}
test('full weeks produce reproducible runway, trend and observed payment changes',()=>{
 const rows=riskRecords(14,{savings:3000,change:{wages:40,rent:80,childcare:20}}),r=analyzeHouseholdRisk(rows);
 expect(r.sufficient).toBe(true);expect(r.meanDailyIncome).toBe(40);expect(r.meanDailySpending).toBe(120);expect(r.meanDailyNet).toBe(-80);expect(r.savings).toBe(2650);expect(r.expenseCoverageDays).toBeCloseTo(2650/120);expect(r.depletionDays).toBeCloseTo(2650/80);expect(r.status).toBe('watch');expect(r.trend).toBe('worsening');expect(r.drivers.map(d=>d.key)).toEqual(['wages','rent','childcare']);
 expect(analyzeHouseholdRisk(rows.map(compactSettlement))).toEqual(r);
});
test('insufficient, stale, gapped, partial and unreconciled histories never invent a runway',()=>{
 const all=riskRecords();for(const rows of [all.slice(0,6),all.filter((_,i)=>i!==10),[...all.slice(0,-1),{...all.at(-1),closingSavings:9999}],[...all.slice(0,-1),{...all.at(-1),periodStartMinute:all.at(-1).minute-500}]]){const risk=analyzeHouseholdRisk(rows);expect(risk.sufficient).toBe(false);expect(risk.depletionDays).toBeNull();expect(risk.status).toBe('unknown');}
 expect(analyzeHouseholdRisk(all.map(({periodStartMinute,...legacy})=>legacy)).sufficient).toBe(false);
 const stale=analyzeHouseholdRisk(all,{asOfMinute:15*1440});expect(stale.status).toBe('unknown');expect(stale.savings).toBeNull();expect(stale.meanDailySpending).toBeNull();
 expect(analyzeHouseholdRisk([],{savings:0}).status).toBe('critical');expect(analyzeHouseholdRisk([],{savings:0}).depletionDays).toBeNull();
});
test('positive cashflow, zero spending and duplicated saves remain finite and correctly classified',()=>{
 const rows=riskRecords(7),r=analyzeHouseholdRisk([...rows,...rows]);expect(r.consecutiveDays).toBe(7);expect(r.trend).toBe('unknown');expect(r.depletionState).toBe('not-depleting');expect(r.depletionDays).toBeNull();expect(r.status).toBe('stable');
 const zero=analyzeHouseholdRisk(riskRecords(7,{rent:0,food:0}));expect(zero.expenseCoverageDays).toBeNull();expect(zero.status).toBe('stable');expect(JSON.stringify(zero)).not.toContain('Infinity');
 expect(analyzeHouseholdRisk(riskRecords(7,{savings:500,wages:0,rent:50,food:0})).status).toBe('critical');
 const better=analyzeHouseholdRisk(riskRecords(14,{change:{wages:130}}));expect(better.trend).toBe('improving');
});
test('model risk uses the same household payments, survives restore and joins the visible sample by household ID',()=>{
 const model=createPopulationModel({population:10});for(let day=1;day<=7;day++)stepPopulation(model,{tick:day,minutes:1440});
 const snapshot=snapshotPopulation(model),h=snapshot.households[0];expect(h.financialRisk.sufficient).toBe(true);expect(h.financialRisk.savings).toBe(h.savings);expect(h.financialRisk).toEqual(modelHouseholdRisk(model,0));
 const restored=restorePopulation(serializePopulation(model));expect(snapshotPopulation(restored).households).toEqual(snapshot.households);
 const rows=visiblePopulationRows({visibleAgents:[{id:'p',householdId:'h',x:1,z:2},{id:'q',householdId:'not-recorded',x:2,z:3}],households:[{id:'h',financialRisk:{status:'critical'}}]});expect(rows.map(r=>r.householdRisk)).toEqual(['critical','unknown']);
});
