import {test,expect} from 'bun:test';
import {readFile} from 'node:fs/promises';
import {createContext,SourceTextModule,SyntheticModule} from 'node:vm';
import {DEFAULT_RECIPE,MONTHS,assertMonth} from '../world/future-machine/contracts.js';
import {createDemoController} from '../world/future-machine/demo-controller.js';
import {createFirstPlayFunnel,visibleDivergence} from '../world/future-machine/first-play.js';
import * as sharing from '../world/future-machine/share/index.js';
import * as recent from '../world/future-machine/recent.js';

// Isolate the real coordinator module; renderer/network adapters are controlled
// at their existing boundaries. Model results have separate actual-engine tests.
const source=await readFile(new URL('../world/future-machine/main.js',import.meta.url),'utf8');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function historyFor(recipe=DEFAULT_RECIPE,id='city_coordinator'){
 const snapshots=()=>Array.from({length:121},(_,month)=>({month,state:{households:[],buildings:[],provenance:{assumptions:[]}},metrics:{},events:[],causalRecords:[],decisions:[]}));
 return {schemaVersion:'future-machine.v1',modelVersion:recipe.modelVersion,seed:recipe.seed,recipe:structuredClone(recipe),experimentId:id,initialHash:'fixture-only',baseline:snapshots(),plan:snapshots(),provenance:{}};
}
const diffFor=month=>({month,available:true,changedCount:month>=16?1:0,physicalCount:month>=16?1:0,entities:[],metrics:{housingUnits:{baseline:36,plan:month>=16?60:36,delta:month>=16?24:0,unit:'homes',status:'available'}}});
const first={month:16,entity:{collection:'buildings',id:'building-recorded',arm:'plan'}};
const receipt={future:'plan',month:16,eventId:'event-recorded',entity:first.entity,payload:{units:24},policyId:'policy-recorded'};
async function boot(options={}){
 let time=0,nextId=1,callbacks,receiptCallbacks,description,storyCallbacks;
 const raf=new Map(),intervals=new Map(),stages=[],updates=[],announcements=[],requests=[],writes=[];
 const storage=new Map(options.recent?[[recent.RECENT_KEY,JSON.stringify(options.recent)]]:[]);
 const location=new URL(options.url??'https://example.test/world/future-machine.html?renderer=canvas2d');
 const node=()=>({after(){},prepend(){},replaceChildren(){},remove(){},click(){},querySelector(){return this;}});
 const app=node(),document={hidden:false,querySelector:()=>app,createElement:node,addEventListener(){},removeEventListener(){}};
 const navigator={clipboard:{writeText:options.copy??(async()=>{})},share:options.nativeShare??(async()=>{})};
 const window={history:{replaceState(_a,_b,url){location.href=url;writes.push(url);}},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},addEventListener(){},removeEventListener(){}};
 const context=createContext({document,window,navigator,location,performance:{now:()=>time},structuredClone,URL,URLSearchParams,AbortController,Blob,console,setTimeout,clearTimeout,
  requestAnimationFrame:fn=>{const id=nextId++;raf.set(id,fn);return id;},cancelAnimationFrame:id=>raf.delete(id),
  setInterval:fn=>{const id=nextId++;intervals.set(id,fn);return id;},clearInterval:id=>intervals.delete(id)});
 const noop=()=>{};
 const modules={
  './contracts.js':{DEFAULT_RECIPE,MONTHS,assertMonth},
  './ui/index.js':{createUI(_host,events){callbacks=events;return {stageElement:node(),storyElement:node(),update:state=>updates.push(structuredClone(state)),dispose:noop};}},
  './demo-controller.js':{createDemoController:args=>createDemoController({...args,now:()=>time,schedule:fn=>{const id=nextId++;intervals.set(id,fn);return id;},unschedule:id=>intervals.delete(id)})},
  './first-play.js':{createFirstPlayFunnel:args=>{const funnel=createFirstPlayFunnel({...args,now:()=>time});return {...funnel,record:(type,payload,settings)=>funnel.record(type,structuredClone(payload),settings)};},visibleDivergence},
  './data/index.js':{validateRecipe:sharing.validateRecipe,getFrame:(h,month)=>({month,baseline:h.baseline[month],plan:h.plan[month]}),
   createExperiment:async(recipe,settings)=>{requests.push(['create',structuredClone(recipe)]);return options.create?options.create(recipe,settings):historyFor(recipe,`city_${recipe.seed}`);},
   loadExperiment:async(id,settings)=>{requests.push(['load',id]);return options.load?options.load(id,settings):historyFor(DEFAULT_RECIPE,id);}},
  './diff/index.js':{compareHistory:()=>Array.from({length:121},(_,month)=>diffFor(month)),firstDivergence:()=>first},
  './scene/index.js':{createStage(_host,{history,onSelect}){
   const gate=history&&options.graphicsGate?options.graphicsGate:null;
   let backend=gate?'pending':'canvas2d';
   const stage={onSelect,history,disposed:false,setMode:noop,setGhosts:noop,resetCamera:noop,update:noop,focus:()=>true,getStats:()=>({backend}),whenReady:()=>gate?gate.promise.then(()=>{backend='canvas2d';}):Promise.resolve(),dispose(){this.disposed=true;}};
   stages.push(stage);return stage;
  }},
  './ui/outcome-timeline.js':{createOutcomeTimeline:()=>({update:(month,settings)=>{if(settings?.announce)announcements.push(month);},dispose:noop})},
  './story/index.js':{buildStory:()=>({summary:'Recorded pair.',stops:[first],limitations:[]}),describeSelection:()=>({title:'Recorded building',summary:'Recorded entity.',evidence:[receipt],limitations:[]}),renderStory(_host,value,events){description=value;storyCallbacks=events;return noop;}},
  './story/evidence-trail-view.js':{renderEvidenceTrail:()=>Object.assign(noop,{update:noop})},
  './story/game-director.js':{selectMoments:()=>[]},'./story/moment-narrative.js':{renderMoments:()=>noop},
  './evidence.js':{constructionReceipts:(_h,_e,month)=>month>=16?[receipt]:[],metricChangeStops:(_h,diff,key)=>key==='housingUnits'&&diff.month>=16?[{...first,title:'Recorded housing completion',evidence:[receipt]}]:[]},
  './rent-decomposition.js':{decomposeRent:frame=>frame,renderRentDecomposition:noop},
  './butterfly-ledger.js':{mountLedger:()=>noop},'./share/card.js':{downloadShareCard:noop},
  './share/index.js':{...sharing},'./recent.js':{...recent},
  './ui/replay-receipt.js':{mountReplayReceipt(_host,events){receiptCallbacks=events;return {update:noop,dispose:noop};}},
  './share/run-receipt.js':{replayRunReceipt:async(input,settings)=>{requests.push(['receipt',structuredClone(input)]);return options.reopen(input,settings);}},
  './ui/challenges.js':{createChallengeCards:()=>({update:noop,dispose:noop})},
  './share/challenges.js':{parseChallengeURL:async()=>options.challenge?await options.challenge():null,verifyChallengeHistory:async(h,c)=>{requests.push(['verify',h.experimentId]);await options.verify?.(h,c);}},
 };
 const main=new SourceTextModule(source,{context});
 await main.link(specifier=>{const exports=modules[specifier];if(!exports)throw Error(`Missing adapter: ${specifier}`);return new SyntheticModule(Object.keys(exports),function(){for(const [name,value]of Object.entries(exports))this.setExport(name,value);},{context});});
 await main.evaluate();
 const drain=async()=>{for(let i=0;i<16;i++){await Promise.resolve();for(const [id,fn]of [...raf]){raf.delete(id);fn();}}};
 await drain();
 return {window,callbacks,receiptCallbacks,stages,updates,announcements,requests,writes,storage,location,drain,
  get state(){return window.futureMachine.state;},get description(){return description;},get storyCallbacks(){return storyCallbacks;},
  tick(ms){time+=ms;for(const fn of [...intervals.values()])fn();},dispose:()=>window.futureMachine.dispose()};
}

test('prepared tour retains pause through data and graphics readiness, then manual seek cancels playback',async()=>{
 const data=deferred(),graphics=deferred();const app=await boot({create:()=>data.promise,graphicsGate:graphics});
 try{
  const playing=app.callbacks.onDemo();app.callbacks.onDemoPause();
  expect(app.state.demo).toMatchObject({status:'preparing',paused:true});
  data.resolve(historyFor());await app.drain();expect(app.state.status).toBe('ready');
  expect(app.state.demo).toMatchObject({status:'preparing',paused:true});
  graphics.resolve();await playing;await app.drain();
  expect(app.state.demo).toMatchObject({status:'playing',paused:true});
  app.tick(20000);expect(app.state.month).toBe(0);
  app.callbacks.onDemoPause();app.tick(10000);expect(app.state.month).toBe(16);
  app.callbacks.onMonth(73);app.tick(50000);await app.drain();
  expect(app.state.demo.status).toBe('manual');expect(app.state.month).toBe(73);expect(app.announcements.at(-1)).toBe(73);
 }finally{app.dispose();}
});

test('manual takeover during preparation allows the pair to finish without delayed autoplay',async()=>{
 const data=deferred(),graphics=deferred();const app=await boot({create:()=>data.promise,graphicsGate:graphics});
 try{
  const playing=app.callbacks.onDemo();app.callbacks.onDemoManual();data.resolve(historyFor());graphics.resolve();await playing;await app.drain();app.tick(50000);
  expect(app.state.status).toBe('ready');expect(app.state.demo.status).toBe('manual');expect(app.state.month).toBe(0);
 }finally{app.dispose();}
});

test('strict receipt retry retains its payload and announces the reopened month; local storage needs consent',async()=>{
 let attempts=0;const input={schemaVersion:'fixture-receipt',checksum:'fixture'};
 const app=await boot({reopen:async()=>{if(++attempts===1)throw Error('connection interrupted');return {history:historyFor(),month:73};}});
 try{
  await expect(app.receiptCallbacks.onReopen(input)).rejects.toThrow('connection interrupted');
  await app.callbacks.onRetry();await app.drain();
  expect(app.requests.filter(row=>row[0]==='create')).toHaveLength(0);expect(app.requests.filter(row=>row[0]==='receipt').map(row=>row[1])).toEqual([input,input]);
  expect(app.state.status).toBe('ready');expect(app.state.month).toBe(73);expect(app.announcements.at(-1)).toBe(73);expect(app.storage.size).toBe(0);
  app.callbacks.onRemember();app.callbacks.onConfigure({...DEFAULT_RECIPE,seed:99});app.callbacks.onMonth(74);await app.drain();
  expect(JSON.parse(app.storage.get(recent.RECENT_KEY))).toMatchObject({recipe:{seed:42},month:74});
  expect(app.updates.at(-1).comparisonRecipe.seed).toBe(42);expect(app.updates.at(-1).recipe.seed).toBe(99);
  app.callbacks.onClearRecent();app.callbacks.onMonth(75);expect(app.storage.size).toBe(0);
 }finally{app.dispose();}
});

test('a newer run supersedes an unresolved receipt without publishing the old history',async()=>{
 const pending=deferred();const app=await boot({reopen:()=>pending.promise});
 try{
  const reopening=app.receiptCallbacks.onReopen({checksum:'fixture'});
  const next={...DEFAULT_RECIPE,seed:99};await app.callbacks.onRun(next);await app.drain();
  pending.resolve({history:historyFor(),month:16});await expect(reopening).rejects.toThrow('superseded');
  expect(app.state.recipe.seed).toBe(99);expect(app.window.futureMachine.history.seed).toBe(99);
 }finally{app.dispose();}
});

test('challenge retry never falls back and preserves its original hash across exact-month navigation',async()=>{
 let attempts=0;const h=historyFor(),challenge={recipe:h.recipe,experimentId:h.experimentId,month:16,question:'Recorded question'};
 const url=sharing.createShareURL(challenge,'https://example.test/world/future-machine.html')+'#validated-challenge-fixture';
 const app=await boot({url,challenge:async()=>challenge,load:async()=>{if(++attempts===1)throw Error('Experiment not found');return h;}});
 try{
  expect(app.state.status).toBe('error');expect(app.requests.filter(row=>row[0]==='create')).toHaveLength(0);
  await app.callbacks.onRetry();await app.drain();expect(app.state.status).toBe('ready');
  expect(app.state.challengeQuestion).toBe(challenge.question);expect(app.location.hash).toBe('#validated-challenge-fixture');
  app.callbacks.onMonth(17);expect(app.location.hash).toBe('');app.callbacks.onMonth(16);expect(app.location.hash).toBe('#validated-challenge-fixture');
  expect(app.requests.filter(row=>row[0]==='verify')).toHaveLength(1);expect(app.announcements.at(-1)).toBe(16);
 }finally{app.dispose();}
});

test('user run wins over delayed startup challenge validation',async()=>{
 const validation=deferred();const app=await boot({challenge:()=>validation.promise});
 try{
  await app.callbacks.onRun({...DEFAULT_RECIPE,seed:99});await app.drain();
  validation.resolve({recipe:DEFAULT_RECIPE,experimentId:'city_stale',month:16,question:'Old'});await app.drain();
  expect(app.requests.filter(row=>row[0]==='load')).toHaveLength(0);expect(app.window.futureMachine.history.seed).toBe(99);expect(app.state.challengeQuestion).toBeNull();
 }finally{app.dispose();}
});

test('automatic frames leave URL and summary quiet; explicit event and native-share milestones remain truthful',async()=>{
 const app=await boot({nativeShare:async()=>{throw new DOMException('Cancelled','AbortError');}});
 try{
  await app.callbacks.onRun(DEFAULT_RECIPE);await app.drain();
  app.callbacks.onPlay(true);const writes=app.writes.length,announcements=app.announcements.length;
  for(let i=0;i<20;i++)app.tick(200);await app.drain();
  expect(app.writes.length).toBe(writes);expect(app.announcements.length).toBe(announcements);
  app.callbacks.onPlay(false);expect(app.announcements.at(-1)).toBe(20);
  app.callbacks.onMetric('housingUnits');expect(app.description.metricKey).toBe('housingUnits');
  app.storyCallbacks.onJump(app.description.stops[0]);expect(app.state.month).toBe(16);expect(app.description.entity.arm).toBe('plan');
  await app.callbacks.onBrowserShare();await app.callbacks.onShare();
  const events=app.window.futureMachine.firstPlayEvents;
  expect(events.filter(row=>row.event.type==='share')).toHaveLength(1);
  expect(events.find(row=>row.event.type==='share').event.payload).toEqual({method:'native',result:'canceled'});
  expect(events.find(row=>row.event.type==='first_divergence').event).toMatchObject({schemaVersion:'hbl.first-play.v2',payload:{facts:{modelVersion:DEFAULT_RECIPE.modelVersion}}});
 }finally{app.dispose();}
});

test('WHY and settled sharing during progressive graphics loading are retained once readiness is measured',async()=>{
 const graphics=deferred();const app=await boot({graphicsGate:graphics});
 try{
  await app.callbacks.onRun(DEFAULT_RECIPE);await app.drain();app.callbacks.onMonth(16);app.callbacks.onMetric('housingUnits');await app.callbacks.onShare();
  expect(app.window.futureMachine.firstPlayEvents.some(row=>row.event.type==='share')).toBe(false);
  graphics.resolve();await app.drain();
  const rows=app.window.futureMachine.firstPlayEvents;
  expect(rows.filter(row=>row.event.type==='why_opened')).toHaveLength(1);
  expect(rows.filter(row=>row.event.type==='share')).toHaveLength(1);
  expect(rows.find(row=>row.event.type==='share').event.payload).toEqual({method:'copy',result:'succeeded'});
 }finally{app.dispose();}
});

test('explicit Play Demo entry outranks remembered nondefault context',async()=>{
 const app=await boot({url:'https://example.test/world/future-machine.html?renderer=canvas2d&demo=1',recent:{recipe:{...DEFAULT_RECIPE,seed:99},experimentId:'city_recent',month:73}});
 try{
  await app.drain();expect(app.requests.filter(row=>row[0]==='load')).toHaveLength(0);
  expect(app.window.futureMachine.history.recipe).toEqual(DEFAULT_RECIPE);expect(app.state.demo.status).toBe('playing');
 }finally{app.dispose();}
});

test('a failed rerun leaves sharing the completed displayed pair usable',async()=>{
 let attempts=0;const copied=[];const app=await boot({copy:async url=>copied.push(url),create:async recipe=>{if(++attempts>1)throw Error('connection interrupted');return historyFor(recipe);}});
 try{
  await app.callbacks.onRun(DEFAULT_RECIPE);await app.drain();app.callbacks.onMonth(73);
  await app.callbacks.onRun({...DEFAULT_RECIPE,seed:99});await app.drain();expect(app.state.status).toBe('error');
  await app.callbacks.onShare();expect(copied).toHaveLength(1);
  expect(sharing.parseShareURL(copied[0])).toMatchObject({recipe:{seed:42},experimentId:'city_coordinator',month:73});
  expect(app.state.message).toContain('Comparison link copied');expect(app.state.error).toBe('connection interrupted');
 }finally{app.dispose();}
});


test('exploring retained history after a failed rerun still records its actual first divergence',async()=>{
 let attempts=0;const app=await boot({create:async recipe=>{if(++attempts>1)throw Error('connection interrupted');return historyFor(recipe);}});
 try{
  await app.callbacks.onRun(DEFAULT_RECIPE);await app.drain();await app.callbacks.onRun({...DEFAULT_RECIPE,seed:99});
  expect(app.window.futureMachine.firstPlayEvents.some(row=>row.event.type==='first_divergence')).toBe(false);
  app.callbacks.onMonth(16);await app.drain();
  expect(app.window.futureMachine.firstPlayEvents.find(row=>row.event.type==='first_divergence').event.payload.facts).toMatchObject({seed:42,month:16});
 }finally{app.dispose();}
});


test('retained stage readiness flushes earlier actions even when a newer rerun has failed',async()=>{
 let attempts=0;const graphics=deferred();const app=await boot({graphicsGate:graphics,create:async recipe=>{if(++attempts>1)throw Error('connection interrupted');return historyFor(recipe);}});
 try{
  await app.callbacks.onRun(DEFAULT_RECIPE);await app.drain();await app.callbacks.onShare();
  await app.callbacks.onRun({...DEFAULT_RECIPE,seed:99});expect(app.state.status).toBe('error');
  graphics.resolve();await app.drain();
  expect(app.window.futureMachine.firstPlayEvents.find(row=>row.event.type==='share').event.payload.result).toBe('succeeded');
  expect(app.state.status).toBe('error');expect(app.state.error).toBe('connection interrupted');
 }finally{app.dispose();}
});
