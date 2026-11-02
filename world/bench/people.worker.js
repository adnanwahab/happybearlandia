import {createPopulationModel,stepPopulation,snapshotPopulation} from '../population/model.js';
const send=(type,data={})=>postMessage({type,protocol:'hbl-worker.v1',...data});
send('WORKER_READY');
setInterval(()=>send('WORKER_HEARTBEAT'),2000);
function typedBytes(value,seen=new Set()){
 if(!value||typeof value!=='object'||seen.has(value))return 0;seen.add(value);
 if(ArrayBuffer.isView(value))return value.byteLength;if(value instanceof ArrayBuffer)return value.byteLength;
 let total=0;for(const child of Object.values(value))total+=typedBytes(child,seen);return total;
}
onmessage=({data})=>{
 const {taskId,config,days}=data;
 if(!Number.isInteger(days)||days<1||days>31){send('TASK_ERROR',{taskId,error:'Days must be 1–31.'});return;}
 try{
  send('TASK_START',{taskId,kind:'measured-population-benchmark'});
  const start=performance.now(),worldContext={id:'explicit-synthetic-benchmark',districts:[{id:'home',label:'Synthetic home district',x:0,z:0,transit:.6,services:.7},{id:'jobs',label:'Synthetic employment district',x:1800,z:0,transit:.8,services:.8}],provenance:{type:'synthetic-benchmark',calibrated:false}},model=createPopulationModel(config,worldContext),generated=performance.now(),durations=[];
  const initial=snapshotPopulation(model,{visibleLimit:0}),loopStart=performance.now();
  for(let tick=1;tick<=days*24;tick++){const at=performance.now();stepPopulation(model,{tick,minutes:60});durations.push(performance.now()-at);if(tick%6===0)send('TASK_PROGRESS',{taskId,progress:tick/(days*24)});}
  const stepped=performance.now(),snapshot=snapshotPopulation(model,{visibleLimit:100}),snapshotted=performance.now();
  send('TASK_DONE',{taskId,result:{modelVersion:snapshot.modelVersion,config:model.config,worldContext,population:config.population,seed:config.seed,days,steps:durations.length,minutesPerStep:60,generationMs:generated-start,simulationMs:stepped-loopStart,snapshotMs:(loopStart-generated)+(snapshotted-stepped),totalWorkerMs:snapshotted-start,stepMs:durations,typedStateBytes:typedBytes(model),memoryNote:'Typed-array byte lengths only; object overhead, worker heap and GPU memory unavailable.',initialMetrics:initial.metrics||null,finalMetrics:snapshot.metrics||null,initialDecisionCounts:initial.decisionCounts??null,decisionCounts:snapshot.decisionCounts??null,actualSimulatedMinutes:snapshot.minute-initial.minute,clock:{minute:snapshot.minute,tick:snapshot.tick},provenance:snapshot.provenance||null,validation:snapshot.validation||null,phaseTimings:'Internal destination/mode/housing phases unavailable unless model exposes measured timings.'}});
 }catch(error){send('TASK_ERROR',{taskId,error:error.message});}
};
