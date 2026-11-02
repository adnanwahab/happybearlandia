/** Pure canonical WorldRuntime contract v1 — no timers/DOM/second economy.
 * createWorldRuntime({seed=42,geography,worldContext,population:{population:2000},
 * assumptions,scenario:{id,label,parameters},initialMinute=360,history:{...}})
 * -> {step(minutes),snapshot({visibleLimit=500}),observe(),applyScenario(...),
 * inspectPerson/Household/Business(id),trackPerson(id),serialize(),restore(state),subscribe(fn),
 * pause(),resume(),eventsSince(cursor=0),registerSubsystem(system),destroy(),
 * configureCulture(patch),scheduleCultureEvent(event),configureWeather(patch),
 * getWeatherSimulation()}. Culture is enabled by
 * default; culture:false disables it. Culture-enabled clocks require integer
 * committed minutes. Culture never advances the population/economy itself.
 * step is explicit and synchronous; paused step is a no-op. Initial6am is an
 * offset, never burn-in. model.minute is the clock; economy === model.economy.
 * observe() returns population metrics + minute/tick + economy summary.
 * applyScenario accepts {id,label,parameters}, {populationPatch,environmentPatch,trace},
 * or a parameter patch, validates
 * existing population inputs and rejects changed generation/outcome fields.
 * Serialize is structured-clone compatible (typed arrays retained); restore
 * requires this exact runtime/population version and registered custom systems.
 * Integration defaults to SHADOW. This runtime never writes legacy town state.
 */
import {createPopulationModel,stepPopulation,inspectPerson as inspectPopulationPerson,inspectHousehold as inspectPopulationHousehold,serializePopulation,restorePopulation} from '../population/model.js';
import {POPULATION_VERSION,normalizePopulationConfig} from '../population/contracts.js';
import {createWorldClock,validateInitialMinute} from './world-clock.js';
import {createCultureSubsystem,culturePopulationInputs} from './culture-subsystem.js';
import {applyCulturePopulationEvents} from '../culture/population-effects.js';
import {createCultureSimulation} from '../culture/culture-simulation.js';
import {createWeatherSimulation,WEATHER_VERSION} from '../weather/weather-simulation.js';
import {createWorldSnapshot} from './world-snapshot.js';
import {createWorldHistoryStore} from './history-store.js';
import {capturePopulationEvents,populationEventCount,runtimeEvent} from './world-events.js';
import {WORLD_VERSION,WORLD_RUNTIME_VERSION,WORLD_LIMITS,cloneWorld,detachedWorld,normalizeScenario,createOwnership} from './world-state.js';
export {WORLD_VERSION,WORLD_RUNTIME_VERSION,WORLD_LIMITS} from './world-state.js';
const reservedDomains=new Set(['population','residents','households','employment','income','savings','travel','activities','needs','businesses','jobs','businessCash','policy','clock','renderer','economy']);
function populationContext(config){const context=config.worldContext??config.geography??{};if(!context||typeof context!=='object'||Array.isArray(context))throw new Error('worldContext/geography must be an object');return cloneWorld({...(context.districts?{districts:context.districts}:{}),...(context.buildings||context.town?.buildings?{buildings:context.buildings??context.town.buildings}:{} )});}
export function createWorldRuntime(config={}){
 let initialMinute=validateInitialMinute(config.initialMinute??360),worldContext=populationContext(config),geography=cloneWorld(config.geography??worldContext),assumptions=cloneWorld(config.assumptions??{});
 if(config.seed!==undefined&&config.population?.seed!==undefined&&config.seed!==config.population.seed)throw new Error('World and population seed must agree');
 let model=createPopulationModel({population:2000,...config.population,seed:config.seed??config.population?.seed??42},worldContext);
 // Align the initialized fixture without executing any needs/budget/day steps.
 model.minute=initialMinute;model.lastDay=Math.floor(initialMinute/1440);model.economy.day=model.lastDay;
 for(const selected of Object.values(model.activityHistory.selected))selected.trackingStartedMinute=initialMinute;
 model.timeSeries=[{tick:model.tick,minute:initialMinute,...cloneWorld(model.metrics)}];
 let paused=false,destroyed=false,sourceEventCursor=populationEventCount(model),policy={id:'baseline',label:'Baseline',parameters:{},revision:0,adoptedAtMinute:initialMinute,history:[]};
 let provenance={synthetic:true,initialization:{initialMinute,overnightBurnIn:false,elapsedMinutesSimulatedBeforeStart:0},population:cloneWorld(model.provenance),randomness:'existing population counter-based seed/person/day/decision streams; no Math.random or wall-clock decisions',limitations:['Illustrative assumptions; not empirically calibrated.','Legacy remains live-world authority until explicit domain ownership/parity gates pass.']};
 const listeners=new Set(),systems=[];let stepping=false,cultureFacade=null,weatherFacade=null;
 const cultureParameters=cloneWorld(config.culture?.parameters??{}),weatherParameters=cloneWorld(config.weather?.parameters??{});
 const cultureFactory=config.cultureSimulationFactory??createCultureSimulation;
 let cultureProjection=null;
 let history=createWorldHistoryStore(config.history??{}),clock=createWorldClock(model,{initialMinute,isPaused:()=>paused});
 const assertLive=()=>{if(destroyed)throw new Error('World runtime is destroyed');};
 function context(minutes=0){return{seed:model.config.seed,clock:clock.snapshot(),minutes,geography:detachedWorld(geography),assumptions:detachedWorld(assumptions),parameters:detachedWorld(model.config),policy:detachedWorld(policy),weather:detachedWorld(systems.find(system=>system.id==='weather')?.state.snapshot()??null),metrics:detachedWorld(model.metrics)};}
 function core(){return{schemaVersion:'world-state.v2',version:WORLD_VERSION,runtimeVersion:WORLD_RUNTIME_VERSION,modelVersion:POPULATION_VERSION,initialMinute,worldContext:cloneWorld(worldContext),geography:cloneWorld(geography),assumptions:cloneWorld(assumptions),population:serializePopulation(model),culture:{enabled:systems.some(system=>system.id==='culture'),parameters:cloneWorld(systems.find(system=>system.id==='culture')?.state.snapshot().parameters??cultureParameters)},cultureProjection:cloneWorld(cultureProjection),weather:{enabled:systems.some(system=>system.id==='weather'),parameters:cloneWorld(systems.find(system=>system.id==='weather')?.state.snapshot().parameters??weatherParameters)},policy:cloneWorld(policy),paused,sourceEventCursor,provenance:cloneWorld(provenance),subsystems:systems.map(system=>({id:system.id,version:system.version,owns:[...system.owns],state:cloneWorld(system.serialize?system.serialize(system.state):system.state)}))};}
 function snapshot(options){assertLive();return createWorldSnapshot({model,clock,policy,assumptions,geography,ownership:createOwnership(systems),history,subsystems:systems,cultureProjection,provenance},options);}
 function syncWeatherInputs(){const system=systems.find(row=>row.id==='weather');if(!system)return;model.weather=detachedWorld(system.state.snapshot());model.weatherEffects=model.weather.effects;}
 function syncCultureInputs(){
  const system=systems.find(row=>row.id==='culture');if(!system)return[];
  const inputs=culturePopulationInputs(system.state.snapshot());
  const projected=applyCulturePopulationEvents(model,inputs.events,{minute:model.minute});cultureProjection={...projected,unsupported:[...projected.unsupported,...inputs.unsupported]};
  return inputs.events;
 }
 function mutateCulture(operation){
  const system=systems.find(row=>row.id==='culture');if(!system)throw new Error('Culture subsystem is not enabled');
  const saved=system.state.serialize(),priorConfig=model.config,priorProjection=cultureProjection;
  try{const result=operation(system.state);syncCultureInputs();return result;}catch(error){system.state.restore(saved);model.config=priorConfig;cultureProjection=priorProjection;throw error;}
 }
 function notify(){if(!listeners.size)return;const value=snapshot();for(const listener of listeners)try{listener(value);}catch(error){config.onError?.(error);}}
 function adopt(input,{notifyListeners=true,emit=true}={}){
  assertLive();if(stepping)throw new Error('Cannot adopt scenario during a world step');const next=normalizeScenario(input,model.config);
  model.config=next.config;policy={id:next.id,label:next.label,parameters:next.parameters,revision:policy.revision+1,adoptedAtMinute:model.minute,provenance:next.provenance,trace:next.trace,environmentInputs:next.environmentPatch,history:[...policy.history,{id:next.id,minute:model.minute,parameters:cloneWorld(next.parameters)}].slice(-WORLD_LIMITS.maxPolicyHistory)};
  syncCultureInputs();syncWeatherInputs();
  if(emit)history.appendEvents([runtimeEvent('POLICY_ADOPTED',model.minute,{policyId:next.id,parameters:next.parameters,reasonCodes:['VALIDATED_PARAMETER_INPUT'],note:'Outcomes are recomputed by existing model mechanisms, never offset directly.'})]);
  if(notifyListeners)notify();return detachedWorld(policy);
 }
 function registerSubsystem(system,{notifyListeners=true}={}){
  assertLive();if(stepping)throw new Error('Cannot register subsystem during a step');
  if(!system||typeof system.id!=='string'||!/^[a-z][a-z0-9_-]{0,63}$/.test(system.id)||['population','economy','policy','clock'].includes(system.id)||systems.some(row=>row.id===system.id)||typeof system.version!=='string'||!system.version||!Array.isArray(system.owns)||!system.owns.length||new Set(system.owns).size!==system.owns.length||system.owns.some(domain=>typeof domain!=='string'||!domain.length||domain.length>64||reservedDomains.has(domain)||systems.some(row=>row.owns.includes(domain))))throw new Error('Subsystem requires a unique id/version and exclusive non-population/economy domains');
  if(systems.length>=WORLD_LIMITS.maxSubsystems)throw new Error('World subsystem budget exceeded');
  for(const key of ['initialize','step','observe','serialize','restore'])if(system[key]!==undefined&&typeof system[key]!=='function')throw new Error(`Subsystem ${key} must be a function`);
  const registered={...system,owns:[...system.owns],assumptions:cloneWorld(system.assumptions??{})};registered.state=system.initialize?system.initialize(context()):cloneWorld(system.state??{});systems.push(registered);
  if(notifyListeners){history.checkpoint(model.minute,core());notify();}return()=>{throw new Error('Subsystem removal requires an explicit world reset');};
 }
 if(config.scenario)adopt(config.scenario,{notifyListeners:false});
 if(config.weather!==false)registerSubsystem({id:'weather',version:WEATHER_VERSION,owns:['weather'],assumptions:{type:'seeded-coarse-environment',electricity:'Heating/cooling demand multiplier only; no physical grid topology or power dispatch.'},initialize:()=>createWeatherSimulation({seed:model.config.seed,initialMinute,parameters:weatherParameters}),step(simulation,stepContext){const before=simulation.snapshot(),after=simulation.stepTo(stepContext.clock.minute);if(before.condition!==after.condition)stepContext.emit({type:'WEATHER_CHANGED',from:before.condition,to:after.condition,temperatureC:after.temperatureC,rainIntensity:after.rainIntensity,stormIntensity:after.stormIntensity,reasonCodes:['COMMITTED_MODEL_WEATHER']});},observe:simulation=>simulation.snapshot(),serialize:simulation=>simulation.serialize(),restore(saved){const simulation=createWeatherSimulation();simulation.restore(saved);return simulation;}},{notifyListeners:false});
 if(config.culture!==false&&cultureFactory)registerSubsystem(createCultureSubsystem({createSimulation:cultureFactory,model,context:worldContext,initialMinute,parameters:cultureParameters}),{notifyListeners:false});
 for(const system of config.subsystems??[])registerSubsystem(system,{notifyListeners:false});
 syncCultureInputs();syncWeatherInputs();history.recordMetrics(model.minute,model.metrics);history.checkpoint(model.minute,core());
 const runtime={
  get population(){assertLive();return model;},get economy(){assertLive();return model.economy;},
  get weather(){assertLive();return detachedWorld(systems.find(system=>system.id==='weather')?.state.snapshot()??null);},
  get culture(){assertLive();return detachedWorld(systems.find(system=>system.id==='culture')?.state.snapshot()??null);},
  get clock(){assertLive();return detachedWorld(clock.snapshot());},get parameters(){assertLive();return detachedWorld(model.config);},get ownership(){assertLive();return detachedWorld(createOwnership(systems));},
  get subsystems(){return detachedWorld([{id:'population',version:POPULATION_VERSION,owns:['residents','households','employment','income','savings','travel','activities','needs'],advance:'stepPopulation'},{id:'local-economy',version:'local-economy-state.v1',owns:['businesses','jobs','businessCash'],advance:'owned by population step; never registered as a second step'},...systems.map(system=>({id:system.id,version:system.version,owns:system.owns,assumptions:system.assumptions}))]);},
  step(minutes=15,{visibleLimit=500}={}){
   assertLive();if(!Number.isFinite(minutes)||minutes<=0||minutes>1440)throw new Error('World step minutes must be >0 and <=1440');if(stepping)throw new Error('World step is not reentrant');if(systems.some(system=>system.id==='culture')&&!Number.isSafeInteger(model.minute+minutes))throw new Error('Culture-enabled runtime requires committed integer model minutes');if(paused)return snapshot({visibleLimit});
   stepping=true;try{
    const target=model.minute+minutes;
    // Bound source-event ingestion to actual 15-minute model boundaries. Large
    // steps still run daily economy exactly once at each crossed midnight.
    while(model.minute<target-1e-9){syncWeatherInputs();const start=model.minute,cultureEvents=syncCultureInputs();let delta=Math.min(target-start,15-start%15);
     for(const event of cultureEvents)for(const boundary of[event.startMinute,event.endMinute??event.startMinute+event.durationMinutes])if(boundary>start+1e-9)delta=Math.min(delta,boundary-start);
     stepPopulation(model,{minutes:delta});
     const emitted=capturePopulationEvents(model,sourceEventCursor);sourceEventCursor=emitted.total;history.appendEvents(emitted.events,{sourceDropped:emitted.missing});
     for(const system of systems)if(system.step){const emittedBySystem=[];const next=system.step(system.state,{...context(delta),emit:event=>{if(!event||typeof event.type!=='string'||!event.type||event.type.length>128)throw new Error('Subsystem event requires a bounded type');if(emittedBySystem.length>=1000)throw new Error('Subsystem event budget exceeded per step');emittedBySystem.push(runtimeEvent(event.type,model.minute,{...event,system:system.id,minute:model.minute}));}});if(next!==undefined)system.state=next;history.appendEvents(emittedBySystem);}
     syncCultureInputs();syncWeatherInputs();
     if(Math.floor(start/1440)!==Math.floor(model.minute/1440))history.checkpoint(model.minute,core());
    }
    history.recordMetrics(model.minute,model.metrics);
   }finally{stepping=false;}
   notify();return snapshot({visibleLimit});
  },
  snapshot,
  observe(){assertLive();return detachedWorld({...model.metrics,minute:model.minute,tick:model.tick,clock:clock.snapshot(),economy:{day:model.economy.day,totalRevenue:model.economy.totalRevenue,totalTax:model.economy.totalTax,closures:model.economy.closures,openings:model.economy.openings},ownership:createOwnership(systems)});},
  applyScenario:adopt,
  getWeatherSimulation(){assertLive();if(!systems.some(system=>system.id==='weather'))return null;return weatherFacade??=Object.freeze({snapshot:()=>runtime.weather,configure:patch=>runtime.configureWeather(patch)});},
  getWeather(){return runtime.getWeatherSimulation();},
  configureWeather(patch){assertLive();if(stepping)throw new Error('Cannot configure weather during a world step');const system=systems.find(row=>row.id==='weather');if(!system)throw new Error('Weather subsystem is not enabled');const result=system.state.configure(patch);syncWeatherInputs();history.appendEvents([runtimeEvent('WEATHER_PARAMETERS_CHANGED',model.minute,{parameters:cloneWorld(patch),reasonCodes:['VALIDATED_WEATHER_INPUT']})]);history.checkpoint(model.minute,core());notify();return detachedWorld(result);},
  getCultureSimulation(){assertLive();if(!systems.some(system=>system.id==='culture'))return null;return cultureFacade??=Object.freeze({snapshot:()=>snapshot({visibleLimit:0}).culture,configure:patch=>runtime.configureCulture(patch),scheduleEvent:event=>runtime.scheduleCultureEvent(event),get eventTypes(){return runtime.culture.eventTypes;}});},
  getCulture(){return runtime.getCultureSimulation();},
  configureCulture(patch){assertLive();if(stepping)throw new Error('Cannot configure culture during a world step');const system=systems.find(row=>row.id==='culture');const result=mutateCulture(simulation=>simulation.configure(patch));history.appendEvents([runtimeEvent('CULTURE_PARAMETERS_CHANGED',model.minute,{parameters:cloneWorld(patch),reasonCodes:['VALIDATED_CULTURE_INPUT']})]);history.checkpoint(model.minute,core());notify();return detachedWorld(result??system.state.snapshot());},
  scheduleCultureEvent(event){assertLive();if(stepping)throw new Error('Cannot schedule culture during a world step');const system=systems.find(row=>row.id==='culture');const scheduled=mutateCulture(simulation=>simulation.scheduleEvent({...event,startMinute:event?.startMinute??model.minute}));history.appendEvents([runtimeEvent('CULTURE_EVENT_SCHEDULED',model.minute,{event:cloneWorld(scheduled??event),reasonCodes:['EXPLICIT_CULTURE_EVENT_INPUT']})]);if(scheduled&&system.state.snapshot().activeEvents?.some(row=>row.id===scheduled.id))history.appendEvents([runtimeEvent('CULTURE_EVENT_STARTED',model.minute,{system:'culture',cultureEventId:scheduled.id,eventType:scheduled.type,districtId:scheduled.districtId,sourceMinute:scheduled.startMinute,reasonCodes:['COMMITTED_CULTURE_PHASE']})]);history.checkpoint(model.minute,core());notify();return detachedWorld(scheduled??system.state.snapshot());},
  inspectPerson(id){assertLive();return detachedWorld(inspectPopulationPerson(model,id,{track:false}));},
  // Tracking is an explicit diagnostic-state command, never a side effect of
  // inspecting/materializing a selected visible person. The engine retains at
  // most16 tracked actor timelines and a single selected trace index.
  trackPerson(id){assertLive();if(stepping)throw new Error('Cannot change person tracking during a world step');const known=new Set(Object.keys(model.activityHistory.selected));const person=inspectPopulationPerson(model,id);if(!person)return null;if(!known.has(person.id)){model.activityHistory.selected[person.id].trackingStartedMinute=model.minute;if(person.history.actorTimeline)person.history.actorTimeline.trackingStartedMinute=model.minute;}return detachedWorld(person);},
  inspectHousehold(id){assertLive();return detachedWorld(inspectPopulationHousehold(model,id));},
  inspectBusiness(id){assertLive();const business=typeof id==='number'?model.economy.businesses[id]:model.economy.businesses.find(row=>row.id===id);return business?detachedWorld({...business,districtId:model.districts[business.district].id,synthetic:true,authority:'population-model.economy',limitations:['Business staffing is district capacity allocation; individual worker-to-firm assignment is not modeled.']}):null;},
  eventsSince(cursor){assertLive();return history.eventsSince(cursor);},
  historySnapshot(){assertLive();return history.snapshot();},
  checkpoint(){assertLive();history.checkpoint(model.minute,core());return history.snapshot().retention;},
  serialize(){assertLive();return{schemaVersion:'world-runtime-state.v1',version:WORLD_VERSION,runtimeVersion:WORLD_RUNTIME_VERSION,core:core(),history:history.serialize()};},
  restore(state){
   assertLive();if(stepping)throw new Error('Cannot restore during a world step');
   if(state?.schemaVersion!=='world-runtime-state.v1'||state.version!==WORLD_VERSION||state.runtimeVersion!==WORLD_RUNTIME_VERSION||state.core?.schemaVersion!=='world-state.v2'||state.core.runtimeVersion!==WORLD_RUNTIME_VERSION||state.core.modelVersion!==POPULATION_VERSION)throw new Error('Unsupported world runtime/model state version');
   const next=cloneWorld(state.core),restored=restorePopulation(next.population);normalizePopulationConfig(restored.config);validateInitialMinute(next.initialMinute);
   if(!Number.isFinite(restored.minute)||restored.minute<next.initialMinute||!Number.isSafeInteger(restored.tick)||restored.tick<0||next.sourceEventCursor!==populationEventCount(restored)||!Array.isArray(next.subsystems)||next.subsystems.length!==systems.length)throw new Error('Inconsistent world clock/events/subsystem state');
   for(const saved of next.subsystems){const registered=systems.find(system=>system.id===saved.id);if(!registered||registered.version!==saved.version||JSON.stringify(registered.owns)!==JSON.stringify(saved.owns))throw new Error('Stored subsystem version or ownership is unavailable');}
   const restoredHistory=createWorldHistoryStore({...state.history?.limits,state:state.history});
   const restoredSystems=next.subsystems.map(saved=>{const registered=systems.find(system=>system.id===saved.id);const state=registered.restore?registered.restore(saved.state):cloneWorld(saved.state);if(['culture','weather'].includes(saved.id)&&state.snapshot().minute!==restored.minute)throw new Error('Stored environment subsystem clock differs from population clock');return{registered,state};});
   model=restored;initialMinute=next.initialMinute;worldContext=next.worldContext;geography=next.geography;assumptions=next.assumptions;policy=next.policy;paused=Boolean(next.paused);sourceEventCursor=next.sourceEventCursor;cultureProjection=next.cultureProjection??null;provenance=next.provenance;history=restoredHistory;for(const item of restoredSystems)item.registered.state=item.state;clock=createWorldClock(model,{initialMinute,isPaused:()=>paused});notify();return snapshot();
  },
  registerSubsystem,
  subscribe(listener){assertLive();if(typeof listener!=='function')throw new Error('Subscriber must be a function');if(listeners.size>=WORLD_LIMITS.maxSubscribers)throw new Error('World subscriber budget exceeded');listeners.add(listener);return()=>listeners.delete(listener);},
  pause(){assertLive();paused=true;notify();return detachedWorld(clock.snapshot());},
  resume(){assertLive();paused=false;notify();return detachedWorld(clock.snapshot());},
  destroy(){destroyed=true;listeners.clear();}
 };
 return runtime;
}
export function restoreWorldRuntime(state,options={}){if(!state?.core?.population?.config)throw new Error('A serialized world runtime state is required');const runtime=createWorldRuntime({...options,population:state.core.population.config,culture:state.core.culture?.enabled?{parameters:state.core.culture.parameters}:false,weather:state.core.weather?.enabled?{parameters:state.core.weather.parameters}:false,initialMinute:state.core.initialMinute,worldContext:state.core.worldContext,geography:state.core.geography,assumptions:state.core.assumptions});runtime.restore(state);return runtime;}
