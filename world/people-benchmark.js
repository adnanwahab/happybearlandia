import {createTrackedWorker,getWorkerRegistry} from './workers/worker-registry.js';
import {validatePopulationConfig,defaultPopulationConfig} from './population/contracts.js';
const form=document.querySelector('form'),status=document.querySelector('[data-status]'),result=document.querySelector('[data-result]'),cancel=document.querySelector('[data-cancel]'),exportButton=document.querySelector('[data-export]'),canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');
let worker=null,report=null,lastFrame=null,frames=[],repaints=0,active=false,jobSequence=0,timeout=null;
function frame(now){if(active){if(lastFrame!==null)frames.push(now-lastFrame);lastFrame=now;repaints++;ctx.fillStyle='#e0ebe8';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#26816e';ctx.fillRect((now*.12)%canvas.width,12,22,45);ctx.fillStyle='#18343d';ctx.fillText(`${repaints} actual animation callbacks`,12,25);}requestAnimationFrame(frame);}requestAnimationFrame(frame);
const percentile=(rows,q)=>rows.length?[...rows].sort((a,b)=>a-b)[Math.min(rows.length-1,Math.floor(rows.length*q))]:null;
function finish(){active=false;clearTimeout(timeout);timeout=null;worker?.terminate();worker=null;cancel.disabled=true;form.querySelector('button').disabled=false;}
function knownDelta(a,b,names){for(const key of names)if(Number.isFinite(a?.[key])&&Number.isFinite(b?.[key]))return{key,value:b[key]-a[key]};return null;}
export function runPeopleBenchmark({population=10000,days=1,seed=42}={}){
 if(active)return Promise.reject(new Error('A bounded benchmark is already running.'));
 const validation=validatePopulationConfig({...defaultPopulationConfig,population,seed});if(!validation.valid)return Promise.reject(new Error(JSON.stringify(validation.errors)));
 if(!Number.isInteger(days)||days<1||days>31)return Promise.reject(new Error('Modeled days must be an integer 1–31.'));
 active=true;report=null;lastFrame=null;frames=[];repaints=0;cancel.disabled=false;exportButton.disabled=true;form.querySelector('button').disabled=true;const wallStart=performance.now(),taskId=`benchmark-${++jobSequence}`;
 status.textContent=`Running ${population.toLocaleString()} synthetic people in an authoritative worker…`;
 return new Promise((resolve,reject)=>{
  const fail=error=>{finish();status.textContent=`Benchmark failed: ${error.message}`;reject(error);};
  try{worker=createTrackedWorker(new URL('./bench/people.worker.js',import.meta.url),{type:'module'},{id:taskId,type:'Population benchmark',protocol:true,ownership:{agentRange:[0,population-1],districtIds:['home','jobs']}});}catch(error){fail(error);return;}
  timeout=setTimeout(()=>fail(new Error('Benchmark exceeded the 120-second deadline.')),120000);
  worker.addEventListener('error',event=>fail(new Error(event.message||'Benchmark worker failed')));
  worker.addEventListener('message',({data})=>{
   if(data.taskId!==taskId)return;
   if(data.type==='TASK_PROGRESS')status.textContent=`Measured simulation ${(data.progress*100).toFixed(0)}% complete`;
   if(data.type==='TASK_ERROR')fail(new Error(data.error));
   if(data.type==='TASK_DONE'){
    const measured=data.result,seconds=measured.simulationMs/1000,decisions=measured.initialDecisionCounts&&measured.decisionCounts?{key:'decisionCounts (recorded model choices)',value:Object.values(measured.decisionCounts).reduce((sum,n)=>sum+n,0)-Object.values(measured.initialDecisionCounts).reduce((sum,n)=>sum+n,0)}:null,trips=knownDelta(measured.initialMetrics,measured.finalMetrics,['trips']);
    report={version:'hbl.people-benchmark.v1',capturedAt:new Date().toISOString(),browser:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency||null,authoritativeWorkers:1,workerCountInvariance:'Not a sharded model; independent worker-count equivalence is not claimed.',...measured,wallMs:performance.now()-wallStart,simulatedDaysPerSecond:seconds>0?measured.actualSimulatedMinutes/1440/seconds:null,decisionsPerSecond:decisions&&seconds>0?{source:decisions.key,value:decisions.value/seconds}:null,tripsPerSecond:trips&&seconds>0?{source:trips.key,value:trips.value/seconds}:null,workerUtilization:null,workerUtilizationNote:'Portable CPU utilization unavailable; task wall time is reported separately.',frameProbe:{callbacks:repaints,medianMs:percentile(frames,.5),p95Ms:percentile(frames,.95),note:'Canvas callback timing during worker work, not full-city renderer FPS.'},workerSnapshot:getWorkerRegistry().getSnapshot()};
    finish();result.textContent=JSON.stringify(report,null,2);status.textContent='Measured benchmark complete.';exportButton.disabled=false;resolve(report);
   }
  });
  worker.postMessage({taskId,config:validation.values,days});
  cancel.onclick=()=>fail(new Error('Cancelled by user; no result substituted.'));
 });
}
form.addEventListener('submit',event=>{event.preventDefault();const data=new FormData(form);runPeopleBenchmark({population:Number(data.get('population')),days:Number(data.get('days')),seed:Number(data.get('seed'))}).catch(()=>{});});
exportButton.onclick=()=>{if(!report)return;const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='hbl-people-benchmark.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
window.hblPeopleBenchmark={run:runPeopleBenchmark,getReport:()=>report};
addEventListener('pagehide',finish,{once:true});
