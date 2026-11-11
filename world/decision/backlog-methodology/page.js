import { housingModel, parameters, limitations } from '../../models/housing/schema.js';
import { housingCausalRegistry } from '../../models/housing/causal-registry.js';
import { runPublishedHousingDiagnostic } from '../backtest.js';
import { mountMethodology, serializeMethodology } from './report.js';
const show = (id,value) => {const pre=document.createElement('pre');pre.textContent=JSON.stringify(value,null,2);document.getElementById(id).append(pre);};
show('model',{model:housingModel,registry:housingCausalRegistry,assumptions:parameters});
show('limits',limitations);
const status=document.getElementById('status'), run=document.getElementById('run'), download=document.getElementById('download');
let result=null;
run.addEventListener('click',async()=>{
 run.disabled=true;download.disabled=true;result=null;document.getElementById('report').replaceChildren();status.textContent='Running retrospective diagnostic…';
 try {result=await runPublishedHousingDiagnostic({runs:20,seed:42});mountMethodology(document.getElementById('report'),result);status.textContent='Retrospective diagnostic complete. Not empirical forecast validation.';download.disabled=false;}
 catch {status.textContent='Diagnostic unavailable. No report or download was produced. Retry or return to Decision Studio.';}
 finally {run.disabled=false;}
});
download.addEventListener('click',()=>{if(!result)return;const url=URL.createObjectURL(new Blob([serializeMethodology(result)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='housing-methodology-report.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
