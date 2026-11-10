import {test,expect} from 'bun:test';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createEconomyRecordsHandler} from '../world/economy-records-api.js';
test('risk API uses only collected payments at the chosen snapshot, isolates runs and refuses injected live risk',async()=>{
 const root=mkdtempSync(join(tmpdir(),'hbl-risk-'));try{
 const handle=createEconomyRecordsHandler({root});let earlyId,latestId;
 for(let day=1;day<=14;day++){
 const openingSavings=3000-(day-1)*50,record={id:`h:${day}`,householdId:'h',minute:day*1440,periodStartMinute:(day-1)*1440,openingSavings,closingSavings:openingSavings-50,entries:[{category:'wages',amount:50},{category:'rent',amount:-100}],sources:[],events:[]};
 const body={runId:'population_risk_0',tick:day*48,minute:day*1440,metrics:{},people:[],events:[],households:[{id:'h',savings:record.closingSavings,moneyHistory:record,financialRisk:{status:'critical'}},{id:'unknown',savings:500,financialRisk:{status:'stable'}}]};
 const saved=await(await handle(new Request('http://localhost/api/economy-records',{method:'POST',body:JSON.stringify(body)}))).json();if(day===6)earlyId=saved.id;latestId=saved.id;
 }
 const risk=async id=>{const response=await handle(new Request(`http://localhost/api/economy-records?risk=1&snapshot=${id}`));return{status:response.status,...await response.json()}};
 const early=await risk(earlyId);expect(early.households[0].financialRisk.status).toBe('unknown');expect(early.households[0].financialRisk.consecutiveDays).toBe(6);
 const latest=await risk(latestId);expect(latest.runId).toBe('population_risk_0');expect(latest.households[0].financialRisk.sufficient).toBe(true);expect(latest.households[0].financialRisk.status).toBe('watch');expect(latest.households[0].financialRisk.trend).toBe('steady');expect(latest.households[1].financialRisk.status).toBe('unknown');
 expect((await risk('invalid')).status).toBe(400);expect((await risk(9999)).status).toBe(404);
 }finally{rmSync(root,{recursive:true,force:true})}
});
