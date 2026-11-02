import {createWeatherSimulation} from '../weather/weather-simulation.js';
import {validateWeatherTimeline,MAX_WEATHER_COMMANDS} from '../weather/weather-inputs.js';
/** POPULATION RUNTIME CONTRACT (browser, no DOM):
 * createPopulationRuntime({config,worldContext,workerCount=2,onUpdate,onError})
 * => {ready:Promise,getSnapshot(),subscribe(fn),pause(),resume(),step(),
 * setSpeed(n),updateConfig(config),inspectPerson(id),inspectHousehold(id),destroy()}.
 * updateConfig is an explicit RESET/RESEED, with reset provenance; it is never a
 * silent policy mutation. Simulation clock is fixed-step, independent of RAF.
 * Frames are typed transferable visible-agent snapshots, not whole populations.
 * Models adapter API must be agreed before execution; see population.worker.js.
 */
import { validatePopulationConfig,POPULATION_VERSION,ACTIVITIES } from "./contracts.js";
import { createWorkerPool } from "../workers/priority-pool.js";
const copy=(value)=>structuredClone(value);
/** Pure scheduling clock. Busy/paused elapsed time is dropped, never queued.
 * In minutes-per-second mode speed=10 means ten modeled minutes/real second.
 * reset(realNow) anchors control changes without retrospective elapsed time. */
export function createPopulationClock({clockMode="ticks-per-poll",stepMinutes=30}={}) {
  if(!["ticks-per-poll","minutes-per-second"].includes(clockMode))throw new Error("Unsupported population clock mode");
  if(clockMode==="minutes-per-second"&&stepMinutes!==1)throw new Error("minutes-per-second clock requires stepMinutes:1");
  let last=null,accumulator=0;
  return {reset(realNow=null){last=realNow;accumulator=0;},poll(realNow,{paused=false,busy=false,speed=1,tickMinutes=stepMinutes}={}){
    if(!Number.isFinite(realNow)||!Number.isFinite(speed)||speed<=0)throw new Error("Clock requires finite time and positive speed");
    const elapsed=last===null?0:Math.max(0,Math.min(250,realNow-last));last=realNow;
    if(paused||busy){accumulator=0;return 0;}
    accumulator+=clockMode==="minutes-per-second"?elapsed/1000*speed/tickMinutes: speed;
    const whole=Math.floor(accumulator+1e-9);accumulator-=whole;
    return Math.min(clockMode==="minutes-per-second"?4:32,whole);
  }};
}
export function createPopulationRuntime({config={},worldContext={},workerCount=2,onUpdate,onError,workerFactory,stepMinutes=30,intervalMs=200,clockMode="ticks-per-poll",view=null}={}) {
  const schedulingClock=createPopulationClock({clockMode,stepMinutes});
  workerCount=Math.max(1,Math.min(12,Math.floor(workerCount)));if(!Number.isFinite(workerCount)||!Number.isInteger(stepMinutes)||stepMinutes<1||stepMinutes>1440)throw new Error("Invalid worker count or fixed step duration");
  intervalMs=Math.max(50,Math.min(5000,Number.isFinite(intervalMs)?intervalMs:200));
  const listeners=new Set();if(onUpdate)listeners.add(onUpdate);
  const id=`population_${crypto.randomUUID()}`;
  const url=new URL("./population.worker.js",import.meta.url);
  const live=createWorkerPool({id:`${id}_live`,type:"Population",url,size:1,workerFactory,taskTimeoutMs:60000});
  let futurePool=null,paused=true,destroyed=false,revision=0,tick=0,speed=1,busy=false,snapshot=null,previousRun=null,series=[],checkedConfig,latestReset,activeExperiment=null,selectedPersonId=null,clockTaskId=null;
  let socialTimeline=[],socialBusy=false;
  let weatherTimeline=[],weatherBusy=false,weatherFacade=null;
  const world=copy(worldContext); // one bounded geometry context; no resident records.
  const payload=()=>({sessionId:id,revision,config:checkedConfig,worldContext:world,targetTick:tick,stepMinutes,selectedPersonId,view,socialTimeline:copy(socialTimeline),weatherTimeline:copy(weatherTimeline)});
  function emit(){if(destroyed)return;for(const callback of listeners)try{callback(getSnapshot());}catch(error){onError?.(error);}}
  function accept(result,generation){if(destroyed||generation!==revision)return null;const frame=result.frame;const visibleAgents=frame.ids.map((personId,index)=>({...frame.metadata?.[index],id:personId,personId,householdId:frame.householdIds[index],x:frame.positions[index*2],z:frame.positions[index*2+1],currentActivity:ACTIVITIES[frame.activities[index]]}));snapshot={...result.aggregate,visibleAgents,frame,modelVersion:POPULATION_VERSION,config:copy(checkedConfig),runtime:{id,revision,tick,paused,speed,stepMinutes,clockMode,speedUnits:clockMode==="minutes-per-second"?"modeled minutes / real second":"ticks / polling interval",workerCount:1,futureWorkerCount:workerCount,sharding:false},resetProvenance:{revision,reason:"explicit-config-reset",seed:checkedConfig.seed},previousRun,timeSeries:series};return snapshot;}
  function sample(){if(!snapshot)return;const minute=snapshot.minute??snapshot.time?.minute??tick*stepMinutes;const point={minute,tick,...copy(snapshot.metrics||{}),metrics:copy(snapshot.metrics||{})};if(!series.length||series.at(-1).tick!==tick){series.push(point);if(series.length>240)series.shift();}snapshot.timeSeries=copy(series);}
  function getSnapshot(){if(!snapshot)return null;return{...snapshot,runtime:{...snapshot.runtime,paused,speed},timeSeries:copy(series),previousRun:previousRun?copy(previousRun):null};}
  async function reset(next,weatherInputs){const validation=validatePopulationConfig(next);if(!validation.valid)throw new Error(validation.errors.join("; "));weatherTimeline=weatherInputs!==undefined?validateWeatherTimeline(weatherInputs):snapshot?.weather?.sourceSnapshot?.parameters?[{minute:0,parameters:copy(snapshot.weather.sourceSnapshot.parameters)}]:weatherTimeline;socialTimeline=[];revision++;const generation=revision;paused=true;tick=0;selectedPersonId=null;if(snapshot)previousRun={config:copy(snapshot.config),modelVersion:POPULATION_VERSION,seed:snapshot.config.seed,timeSeries:copy(series),metrics:copy(snapshot.metrics),revision:snapshot.runtime.revision};snapshot=null;series=[];checkedConfig=validation.values;emit();const result=await live.submit({kind:"snapshot",payload:payload(),priority:10,deterministic:true});accept(result,generation);if(generation===revision){sample();emit();}return getSnapshot();}
  latestReset=reset(config);
  const ready=latestReset.then(async result=>{if(latestReset)return await latestReset;return result;});
  async function advance({clockDriven=false}={}){if(destroyed)throw new Error("Population runtime destroyed");if(busy||weatherBusy||socialBusy)return getSnapshot();await latestReset;busy=true;const generation=revision;tick++;const taskId=clockDriven?`clock_${crypto.randomUUID()}`:undefined;if(clockDriven)clockTaskId=taskId;try{const result=await live.submit({id:taskId,kind:"advance",payload:payload(),priority:5,deterministic:true});accept(result,generation);if(generation===revision){sample();emit();}return getSnapshot();}catch(error){if(generation===revision)tick--;if(clockDriven&&error.message==="Task cancelled")return getSnapshot();onError?.(error);throw error;}finally{if(clockTaskId===taskId)clockTaskId=null;busy=false;}}

  function getWeatherSnapshot(){return snapshot?.weather?.sourceSnapshot?{...copy(snapshot.weather.sourceSnapshot),electricity:copy(snapshot.weather.electricity)}:null;}
  async function configureWeather(patch){
   if(destroyed)throw new Error('Population runtime destroyed');await latestReset;
   if(weatherBusy)throw new Error('A weather input change is already pending');weatherBusy=true;
   try{while(busy&&!destroyed)await new Promise(resolve=>setTimeout(resolve,5));if(destroyed)throw new Error('Population runtime destroyed');
    const current=getWeatherSnapshot();if(!current)throw new Error('Weather worker snapshot is not ready');
    const checker=createWeatherSimulation({seed:checkedConfig.seed,initialMinute:current.minute,parameters:current.parameters});const checked=checker.configure(patch).parameters;
    if(weatherTimeline.length>=MAX_WEATHER_COMMANDS)throw new Error('Weather command history limit reached; start a new run');
    const generation=revision;weatherTimeline.push({minute:current.minute,parameters:checked});
    const result=await live.submit({kind:'weather-input',payload:{...payload(),targetTick:snapshot.runtime.tick},priority:15,deterministic:true});
    if(generation!==revision)throw new Error('Weather command belongs to a previous reset');accept(result,generation);sample();emit();return getWeatherSnapshot();
   }finally{weatherBusy=false;schedulingClock.reset(performance.now());}
  }
  function getWeatherSimulation(){if(!snapshot?.weather?.sourceSnapshot)return null;return weatherFacade??=Object.freeze({snapshot:getWeatherSnapshot,configure:configureWeather});}
  function setSpeed(value){if(!Number.isFinite(value)||value<0.25||value>32)throw new Error("Speed must be0.25–32");if(speed!==value){speed=value;schedulingClock.reset(performance.now());emit();}return getSnapshot();}
  const clock=setInterval(()=>{if(destroyed)return;const steps=schedulingClock.poll(performance.now(),{paused,busy:busy||socialBusy,speed,tickMinutes:stepMinutes});if(!steps)return;const generation=revision;void(async()=>{for(let i=0;i<steps&&!paused&&!destroyed&&generation===revision;i++)await advance({clockDriven:true});})().catch(()=>{});},Math.max(50,intervalMs));
  async function inspect(kind,personId){await latestReset;const generation=revision;if(kind==="inspect-person")selectedPersonId=personId;const result=await live.submit({kind,payload:{...payload(),id:personId},priority:20,deterministic:true});if(generation!==revision)throw new Error("Selection belongs to a previous reset");return result;}
  async function socialAction(id,targetId,action){
    if(destroyed)throw new Error('Population runtime destroyed');
    if(socialBusy)throw new Error('Another social encounter is pending');socialBusy=true;
    try{await latestReset;while(busy&&!destroyed)await new Promise(resolve=>setTimeout(resolve,5));
    if(destroyed)throw new Error('Population runtime destroyed');const generation=revision;
    socialTimeline=socialTimeline.filter(c=>c.tick<=tick);
    const result=await live.submit({kind:'social-action',payload:{...payload(),id,targetId,action},priority:20,deterministic:true});
    if(generation!==revision)throw new Error('Encounter belongs to a previous reset');
    socialTimeline.push(result.command);return result;
    }finally{socialBusy=false;schedulingClock.reset(performance.now());}
  }
  function experiments({configs=[checkedConfig],seeds,runs=2,horizonDays=7,onProgress}={}) {
    if(activeExperiment)throw new Error("A population future experiment is already active; cancel or wait");
    if(!Number.isInteger(runs)||runs<1||runs>1000||!Number.isInteger(horizonDays)||horizonDays<1||horizonDays>365||!Array.isArray(configs)||configs.length<1||configs.length>4)throw new Error("Use1–1000 runs,1–4 configs and1–365 days");
    const checked=configs.map(value=>{const row=validatePopulationConfig(value);if(!row.valid)throw new Error(row.errors.join("; "));return row.values;});
    if(checked.reduce((sum,value)=>sum+value.population,0)*runs*horizonDays*48>20000000)throw new Error("Population future work exceeds20million agent-steps; reduce people/runs/horizon");
    const generationFields=["population","representedPopulation","householdSize","medianIncome","incomeSpread","employmentRate","snapshotId","initialBufferMonths"];
    for(const value of checked.slice(1))for(const key of generationFields)if(JSON.stringify(value[key])!==JSON.stringify(checked[0][key]))throw new Error(`Paired futures require identical initial ${key}; use a separate population reset for changed initial demographics`);
    const effectiveWorkers=Math.max(1,Math.min(workerCount,Math.floor(200000/Math.max(...checked.map(value=>value.population)))));
    futurePool ||= createWorkerPool({id:`${id}_futures`,type:"Population futures",url,size:effectiveWorkers,workerFactory,taskTimeoutMs:120000});
    futurePool.resize(effectiveWorkers);
    let cancelled=false,completed=0,next=0;const taskIds=new Set();const rows=[],total=runs*checked.length;const sampleLimit=Math.max(2,Math.min(64,Math.floor(100000/total)));
    const manifest={schemaVersion:"population-experiment.v1",modelVersion:POPULATION_VERSION,configs:copy(checked),worldContext:copy(world),weatherTimeline:copy(weatherTimeline),runs,horizonDays,seeds:seeds?copy(seeds):Array.from({length:runs},(_,index)=>(checked[0].seed+Math.imul(index,2654435761))>>>0),stepMinutes:30,initialPopulationConfig:Object.fromEntries(generationFields.filter(key=>checked[0][key]!==undefined).map(key=>[key,copy(checked[0][key])])),pairing:{sharedSeeds:true,generationFields,policyAppliedFromMinute:0},timeSeriesSampling:{maxPointsPerRun:sampleLimit,totalPointBudget:100000,method:"actual evenly spaced fixed ticks including initial/final",omitsUnsampledTicks:true},createdAt:new Date().toISOString()};
    if(manifest.seeds.length!==runs||manifest.seeds.some(seed=>!Number.isInteger(seed)||seed<0||seed>4294967295))throw new Error("Provide one uint32 seed per paired run");
    const ready=(async()=>{const lanes=Array.from({length:Math.min(effectiveWorkers,total)},async()=>{while(!cancelled&&next<total){const index=next++,configIndex=Math.floor(index/runs),runIndex=index%runs;const taskId=`future_${crypto.randomUUID()}`;taskIds.add(taskId);try{const result=await futurePool.submit({id:taskId,kind:"future",priority:1,deterministic:true,payload:{config:{...checked[configIndex],seed:manifest.seeds[runIndex]},worldContext:world,weatherTimeline:copy(manifest.weatherTimeline),steps:horizonDays*48,stepMinutes:30,sampleLimit,manifest:{modelVersion:POPULATION_VERSION,configIndex,runIndex,seed:manifest.seeds[runIndex]}}});rows.push({...result,status:result.status||"completed"});}catch(error){rows.push({status:cancelled?"cancelled":"failed",configIndex,runIndex,error:error.message});}finally{taskIds.delete(taskId);}completed++;onProgress?.({completed,total,rows:rows.slice(-1),status:cancelled?"cancelling":"running"});}});await Promise.all(lanes);rows.sort((a,b)=>(a.manifest?.configIndex??a.configIndex)-(b.manifest?.configIndex??b.configIndex)||(a.manifest?.runIndex??a.runIndex)-(b.manifest?.runIndex??b.runIndex));return{manifest,rows,status:cancelled?"cancelled":rows.some(row=>row.status==="completed")?"completed":"failed",completed,total,successful:rows.filter(row=>row.status==="completed").length,failed:rows.filter(row=>row.status==="failed").length};})().finally(()=>{activeExperiment=null;});
    activeExperiment={ready,cancel(){cancelled=true;for(const taskId of taskIds)futurePool.cancel(taskId);},getProgress:()=>({completed,total,cancelled})};return activeExperiment;
  }
  async function getActivityHistory(query={}) {
    if(destroyed)throw new Error("Population runtime destroyed");
    if(!query||typeof query!=="object"||Array.isArray(query)||Object.keys(query).some(key=>!["filters","groupBy","includeEvents","includeBuckets","actorId"].includes(key)))throw new Error("Unsupported activity history query");
    const filters=query.filters||{};
    if(!filters||typeof filters!=="object"||Array.isArray(filters)||Object.keys(filters).some(key=>!["districtId","activity","type","personId","householdId"].includes(key)))throw new Error("Unsupported history filters");
    for(const value of [...Object.values(filters),...(query.actorId!==undefined?[query.actorId]:[])])if(typeof value!=="string"||!value||value.length>160||["__proto__","prototype","constructor","toString"].includes(value))throw new Error("History identifiers must be bounded strings");
    if(query.groupBy!==undefined&&!["hour","day"].includes(query.groupBy))throw new Error("History grouping must be hour or day");
    for(const key of["includeEvents","includeBuckets"])if(query[key]!==undefined&&typeof query[key]!=="boolean")throw new Error("History include flags must be booleans");
    await latestReset;const generation=revision;
    const result=await live.submit({kind:"activity-history",payload:{...payload(),targetTick:snapshot?.runtime?.tick??0,query:copy(query)},priority:15,deterministic:true});
    if(destroyed||generation!==revision)throw new Error("History belongs to a previous population reset");
    return{...result,source:{mode:"living",runtimeId:id,revision:generation,modelVersion:POPULATION_VERSION,population:checkedConfig.population,seed:checkedConfig.seed}};
  }
  async function stepToTime(minutes){if(!Number.isFinite(minutes)||minutes<0||minutes>365*1440)throw new Error("Replay time must be0–365 days in minutes");if(minutes%stepMinutes!==0)throw new Error("Replay time must align to the fixed simulation step");const target=minutes/stepMinutes;if(target*checkedConfig.population>20000000)throw new Error("Replay exceeds20million agent-steps");await latestReset;paused=true;const generation=revision;tick=target;const result=await live.submit({kind:"replay",payload:payload(),priority:10,deterministic:true});accept(result,generation);if(generation===revision){sample();emit();}return getSnapshot();}
  async function replayFuture(row,manifest){if(manifest?.schemaVersion!=="population-experiment.v1"||manifest.modelVersion!==POPULATION_VERSION||!row?.manifest||!Number.isInteger(row.manifest.configIndex)||!manifest.configs?.[row.manifest.configIndex]||!Number.isInteger(row.manifest.runIndex)||manifest.seeds?.[row.manifest.runIndex]!==row.manifest.seed||row.manifest.modelVersion!==POPULATION_VERSION)throw new Error("Unsupported or inconsistent population replay manifest");if(!Number.isInteger(manifest.horizonDays)||manifest.horizonDays<1||manifest.horizonDays>365||!Number.isInteger(manifest.stepMinutes)||manifest.stepMinutes<1||manifest.stepMinutes>1440||JSON.stringify(manifest.worldContext)!==JSON.stringify(world))throw new Error("Replay horizon/step/world context is inconsistent; create a runtime with the stored world context");if(manifest.horizonDays*48*manifest.configs[row.manifest.configIndex].population>20000000)throw new Error("Replay exceeds20million agent-steps");stepMinutes=manifest.stepMinutes;latestReset=reset({...manifest.configs[row.manifest.configIndex],seed:row.manifest.seed},manifest.weatherTimeline??[]);await latestReset;return stepToTime(manifest.horizonDays*1440);}
  async function inspectFutureEntity(row,manifest,entity){if(manifest?.schemaVersion!=="population-experiment.v1"||manifest.modelVersion!==POPULATION_VERSION||row?.manifest?.modelVersion!==POPULATION_VERSION||!Number.isInteger(row?.manifest?.configIndex)||!Number.isInteger(row?.manifest?.runIndex)||manifest.seeds?.[row.manifest.runIndex]!==row.manifest.seed||!manifest.configs?.[row.manifest.configIndex]||!["person","household"].includes(entity?.kind)||typeof entity.id!=="string"||entity.id.length>160)throw new Error("Unsupported future entity replay manifest");const config=validatePopulationConfig({...manifest.configs[row.manifest.configIndex],seed:row.manifest.seed});if(!config.valid||!Number.isInteger(manifest.horizonDays)||manifest.horizonDays<1||manifest.horizonDays>365||config.values.population*manifest.horizonDays*48>20000000)throw new Error("Invalid or oversized future entity replay");futurePool ||= createWorkerPool({id:`${id}_futures`,type:"Population futures",url,size:Math.min(workerCount,2),workerFactory,taskTimeoutMs:120000});return futurePool.submit({kind:"future-inspect",priority:20,deterministic:true,payload:{config:config.values,worldContext:manifest.worldContext,weatherTimeline:copy(manifest.weatherTimeline??[]),steps:manifest.horizonDays*48,stepMinutes:manifest.stepMinutes||30,entity}});}
  return{ready,getSnapshot,getActivityHistory,getWeatherSimulation,getWeatherSnapshot,configureWeather,setView(next){if(!next||![next.x,next.z].every(Number.isFinite)||Math.abs(next.x)>1000000||Math.abs(next.z)>1000000)return;view={x:next.x,z:next.z};},subscribe(fn){listeners.add(fn);if(snapshot)fn(getSnapshot());return()=>listeners.delete(fn);},pause(){if(!paused){paused=true;schedulingClock.reset(performance.now());if(clockTaskId)live.cancel(clockTaskId);}emit();},resume(){if(paused){paused=false;schedulingClock.reset(performance.now());}emit();},step:advance,setSpeed,updateConfig(next){schedulingClock.reset(performance.now());latestReset=reset(next);return latestReset;},getJournalPage:async query=>{await latestReset;const generation=revision;const result=await live.submit({kind:'journal-page',payload:{...payload(),query},priority:2,deterministic:true});if(generation!==revision)throw new Error('Journal belongs to a previous population');return result;},socialAction,inspectPerson:id=>inspect("inspect-person",id),inspectHousehold:id=>inspect("inspect-household",id),runExperiments:experiments,inspectFutureEntity,resizeWorkers(count){workerCount=Math.max(1,Math.min(12,Math.floor(count)));futurePool?.resize(workerCount);return workerCount;},replayFuture:replayFuture,stepToTime:stepToTime,destroy(){destroyed=true;paused=true;activeExperiment?.cancel();clearInterval(clock);live.destroy();futurePool?.destroy();listeners.clear();}};
}
