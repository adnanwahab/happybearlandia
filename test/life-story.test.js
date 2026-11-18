import {test,expect,describe} from 'bun:test';
import {buildTown} from '../world/gen.js';
import {createWorld,ACTIONS} from '../world/sim.js';
import {buildLifeStory,digestFacts,LIFE_STORY_VERSION,LIFE_STORY_NARRATION_NOTICE} from '../world/stories/life-story.js';
import {readLegacyLifeStorySource,commandLegacyResident} from '../world/stories/legacy-source.js';
import {chooseNudges} from '../world/stories/life-story-view.js';

const SPOT={lat:29.7286,lng:-95.4746};
function makeWorld(people=40){const world=createWorld(buildTown(SPOT,null,{maxPeople:people}),{recordHistory:true});world.trackActivityPerson('0');return world;}
const numbersIn=text=>(String(text).match(/\d+(?:\.\d+)?/g)??[]).map(Number);
/** Numbers a narration states that no listed fact supports ("2 h 5 min" counts as 125). */
function untraceable(beat){
 const known=[...beat.facts,...(beat.why?.facts??[])].flatMap(f=>numbersIn(`${f.value} ${f.label} ${f.unit??''}`));
 const said=[beat.narration,beat.why?.narration??''].join(' ').replace(/(\d+) h (\d+) min/g,(_,h,m)=>String(h*60+Number(m))).replace(/(\d+) h\b/g,(_,h)=>String(h*60));
 return numbersIn(said).filter(n=>!known.some(k=>k===n||Math.round(k)===n||Math.round(k*10)/10===n));
}
const deepFreeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const child of Object.values(value))deepFreeze(child);}return value;};

function interval(activity,districtId,startMinute,endMinute,needs){return{id:'7',householdId:'h1',districtId,activity,startMinute,endMinute,weight:1,needs};}
const N=(hunger,energy,fun,social)=>({hunger,energy,fun,social});
function fixtureSource(overrides={}){
 return{
  mode:'legacy',minute:520,identity:{runId:'legacy:test:1',modelVersion:'neighborhood-activity.v2',seed:'test-seed',simulationSeed:42},
  person:{id:'7',name:'Rosa Diaz',age:41,trait:'foodie',householdId:'h1',needs:N(80,70,35,52),doing:'watching TV',activity:'RELAX_HOME',
   decisionTrace:[{minute:401,type:'ACTIVITY_SELECTED',chosen:'eat_out',score:12.4,needs:N(31,80,60,50),alternatives:[{activity:'eat_out',buildingId:'b9',score:12.4},{activity:'eat_home',buildingId:'b1',score:7.2},{activity:'relax_home',buildingId:'b1',score:3.1}],reasonCodes:['NEED_URGENCY_AND_SCHEDULE_SCORE']}]},
  household:{id:'h1',cash:84,lastDailyCost:25,lastShortfall:0,stressedDays:0},
  history:{actorTimeline:{fromMinute:360,toMinute:520,droppedIntervals:0,droppedEvents:0,intervals:[
   interval('SLEEP','home',360,380,N(40,90,60,50)),
   interval('IDLE','home',380,381,N(39,90,60,50)),
   interval('SLEEP','home',381,400,N(35,95,60,50)),
   interval('IDLE','home',400,401,N(31,96,60,50)),
   interval('WALK','travel',401,409,N(30,95,59,50)),
   interval('EAT_OUT','food',409,444,N(70,94,62,58)),
   interval('IDLE','food',444,445,N(99,93,63,60)),
   interval('WALK','travel',445,453,N(98,93,62,60)),
   interval('RELAX_HOME','home',453,470,N(95,90,70,59)),
   interval('SOCIAL_CHAT','home',470,473,N(94,90,72,66)),
   interval('RELAX_HOME','home',473,485,N(93,89,80,66)),
   interval('SOCIAL_CHAT','home',485,488,N(92,89,82,70)),
   interval('RELAX_HOME','home',488,520,N(90,88,90,70)),
  ],events:[
   {minute:401,type:'TRIP_STARTED',personId:'7',mode:'walk',activity:'eat_out',destinationId:'b9',distanceMeters:610},
   {minute:409,type:'TRIP_COMPLETED',personId:'7',mode:'walk',travelMinutes:8,distanceMeters:610,destinationId:'b9',socialDelayMinutes:0},
   {minute:409,type:'ACTIVITY_STARTED',personId:'7',activity:'EAT_OUT',buildingId:'b9',cost:12},
   {minute:500,type:'MYSTERY_SIGNAL',personId:'7',reason:'Synthetic test event',strength:3},
  ]}},
  places:{b1:{name:'Diaz residence',kind:'home'},b9:{name:"Nguyen's Tacos",kind:'food'}},
  social:{relationships:[{id:'8',name:'Omar Diaz',label:'Household',friendship:70,trust:55,tension:0,memories:[{minute:471,event:'conversation',text:'Omar Diaz and Rosa Diaz caught up.'},{minute:486,event:'misunderstanding',text:'Omar Diaz took a joke the wrong way.'}]}],goals:[{id:'g1',title:'Make time for Omar Diaz',help:'Arrange a park meetup.',completed:false}],promises:[]},
  options:[{type:'activity',actionId:'eat_out',buildingId:'b9',label:"eating out · Nguyen's Tacos",distanceMeters:610,cost:12},{type:'activity',actionId:'eat_out',buildingId:'b10',label:"eating out · Nguyen's Tacos",distanceMeters:900,cost:12}],
  actionCatalog:{eat_out:{label:'eating out',rate:{hunger:2.6,social:0.6,fun:0.3},cost:12},eat_home:{label:'cooking at home',rate:{hunger:2.6,social:0.2},cost:null},relax_home:{label:'watching TV',rate:{fun:0.55,social:0.15},cost:null},work:{label:'working',rate:{social:0.06},cost:null}},
  ...overrides,
 };
}

describe('Life Story builder',()=>{
 test('turns recorded intervals into readable moments with separate facts',()=>{
  const story=buildLifeStory(deepFreeze(fixtureSource()));
  expect(story.schemaVersion).toBe(LIFE_STORY_VERSION);
  expect(story.narrationNotice).toBe(LIFE_STORY_NARRATION_NOTICE);
  const lines=story.beats.map(b=>`${b.kind}|${b.narration}`);
  expect(lines[0]).toBe('activity|Rosa Diaz slept at home.');
  expect(story.beats[0].facts.find(f=>f.label==='Recorded bouts merged').value).toBe(2);
  expect(lines).toContain("travel|Rosa Diaz walked 8 min to Nguyen's Tacos.");
  expect(lines).toContain("activity|Rosa Diaz ate out at Nguyen's Tacos ($12). They ate their fill: food 30 → 99.");
  expect(lines).toContain('travel|Rosa Diaz walked 8 min home.');
  // Four short alternating moments roll up; the following 32-minute stretch stays its own moment.
  expect(lines).toContain('routine|Rosa Diaz spent 35 min at home switching between watching TV and chatting with Omar Diaz.');
  expect(story.beats.find(b=>b.kind==='routine').facts.find(f=>f.label==='Moments summarized').value).toBe(4);
  expect(lines).toContain('activity|Rosa Diaz unwound at home in front of the TV.');
  expect(lines).toContain('social|A moment with Omar Diaz: Omar Diaz took a joke the wrong way.');
  // Generic "caught up" memories are folded into the routine instead of repeated.
  expect(lines.some(l=>l.includes('caught up'))).toBe(false);
 });

 test('explains choices from the decision trace without inventing values',()=>{
  const story=buildLifeStory(fixtureSource());
  const meal=story.beats.find(b=>b.activity==='EAT_OUT');
  expect(meal.why.narration).toBe('Eating out restores food, which was 31/100 when they decided. It scored 12.4, ahead of eating at home (7.2).');
  expect(meal.why.facts.find(f=>f.label==='Chosen score').value).toBe(12.4);
  expect(meal.facts.find(f=>f.label==='Price paid')).toMatchObject({value:'$12',source:'recorded event'});
  for(const beat of story.beats){
   const known=new Set([...beat.facts,...(beat.why?.facts??[])].flatMap(f=>numbersIn(`${f.value} ${f.label} ${f.unit??''}`)).concat(numbersIn(beat.clock)));
   for(const number of numbersIn(beat.narration))expect(known.has(number)||[...known].some(k=>Math.round(k)===number)).toBe(true);
   for(const number of numbersIn(beat.why?.narration??''))expect([...known].some(k=>Math.round(k)===number||Math.round(k*10)/10===number)).toBe(true);
  }
 });

 test('obligations and idle choices are explained as such',()=>{
  const source=fixtureSource();
  source.person.decisionTrace=[{minute:401,chosen:'eat_out',score:0.4,needs:N(96,90,95,90),alternatives:[{activity:'eat_out',buildingId:'b9',score:0.4},{activity:'relax_home',buildingId:'b1',score:0.3}],reasonCodes:['NEED_URGENCY_AND_SCHEDULE_SCORE']}];
  expect(buildLifeStory(source).beats.find(b=>b.activity==='EAT_OUT').why.narration).toStartWith('Nothing was pressing: every option scored below 1.');
 });

 test('unknown recorded events are described in words, never as JSON',()=>{
  const story=buildLifeStory(fixtureSource());
  const mystery=story.beats.find(b=>b.type==='MYSTERY_SIGNAL');
  expect(mystery.narration).toBe('Mystery signal was recorded for Rosa Diaz.');
  expect(mystery.facts.find(f=>f.label==='Reason').value).toBe('Synthetic test event');
  for(const beat of story.beats)expect(beat.narration).not.toMatch(/[{}"]/);
 });

 test('is deterministic, and the digest tracks facts rather than wording',()=>{
  const a=buildLifeStory(fixtureSource()),b=buildLifeStory(fixtureSource());
  expect(b).toEqual(a);
  const changed=fixtureSource();changed.history.actorTimeline.intervals[5]={...changed.history.actorTimeline.intervals[5],endMinute:443};
  expect(buildLifeStory(changed).factsDigest).not.toBe(a.factsDigest);
  expect(digestFacts({b:1,a:[1,2]})).toBe(digestFacts({a:[1,2],b:1}));
 });

 test('reports retention gaps instead of reconstructing them',()=>{
  const source=fixtureSource();source.history.actorTimeline.droppedIntervals=5;source.history.actorTimeline.droppedEvents=12;
  const gaps=buildLifeStory(source).gaps.map(g=>g.kind);
  expect(gaps).toEqual(['routine-not-retained','detail-not-retained']);
  const empty=buildLifeStory(fixtureSource({history:{actorTimeline:{intervals:[],events:[],droppedIntervals:0,droppedEvents:0}}}));
  expect(empty.beats).toEqual([]);expect(empty.gaps[0].kind).toBe('empty');
 });

 test('events-only sources (living population) tell recorded starts and trips',()=>{
  const story=buildLifeStory({mode:'living',minute:600,identity:{runId:'living:1:2'},person:{id:'p3',name:'Ana Li',needs:{}},places:{},
   history:{recentEvents:[{minute:500,type:'TRIP_COMPLETED',personId:'p3',mode:'walk',travelMinutes:11.5,to:'district-2'},{minute:501,type:'ACTIVITY_STARTED',personId:'p3',activity:'DINING',reason:'hungry'},{minute:520,type:'PLAYER_WALK_REQUESTED',personId:'p3',plannedMinutes:4}]}});
  expect(story.beats.map(b=>b.narration)).toEqual(['Ana Li completed a trip of 12 min.','Ana Li started dining.','You sent Ana Li on a walk.']);
  expect(story.beats.at(-1).kind).toBe('influence');
 });

 test('now section and hooks come from current state',()=>{
  const story=buildLifeStory(fixtureSource());
  expect(story.now.narration).toBe('Rosa Diaz is watching TV.');
  expect(story.now.lowestNeed).toBe('fun');
  expect(story.now.hooks.map(h=>h.kind)).toEqual(['need','goal']);
  expect(story.now.facts.find(f=>f.label==='Household cash').value).toBe('$84');
  expect(()=>buildLifeStory({person:{}})).toThrow('selected resident');
 });

 test('nudges keep the nearest distinct places',()=>{
  expect(chooseNudges(fixtureSource().options).map(o=>`${o.buildingId}:${o.placeName}`)).toEqual(["b9:Nguyen's Tacos"]);
 });
});

describe('Life Story on the real legacy World model',()=>{
 test('reads recorded days with names, prices and decisions from the model',()=>{
  const world=makeWorld();world.step(600);
  const source=readLegacyLifeStorySource({world,id:'0'});
  const story=buildLifeStory(source);
  expect(story.beats.length).toBeGreaterThanOrEqual(4);
  expect(story.provenance).toMatchObject({mode:'legacy',actorId:'0',modelVersion:world.modelVersion,runId:world.getActivityIdentity().runId});
  const names=new Set(world.buildings.map(b=>b.name));
  for(const beat of story.beats){
   for(const f of beat.facts.filter(f=>f.label==='Place'||f.label==='Destination'))expect(names.has(f.value)).toBe(true);
   for(const f of beat.facts.filter(f=>f.label==='Price paid'))expect(Object.values(ACTIONS).map(a=>a.cost).filter(Boolean).map(c=>`$${c}`)).toContain(f.value);
   if(beat.why)expect(beat.why.chosen.toUpperCase()).toBe(beat.activity);
   expect(beat.narration.length).toBeGreaterThan(10);
  }
  // Every number told, across several residents' real days, is backed by a listed fact.
  for(const id of ['0','3','7','12'])for(const beat of buildLifeStory(readLegacyLifeStorySource({world,id})).beats)expect({narration:beat.narration,untraceable:untraceable(beat)}).toEqual({narration:beat.narration,untraceable:[]});
 });

 test('reading a story never changes the simulation',()=>{
  const watched=makeWorld(),control=makeWorld();
  for(let minute=0;minute<480;minute+=30){watched.step(30);control.step(30);buildLifeStory(readLegacyLifeStorySource({world:watched,id:'0'}));buildLifeStory(readLegacyLifeStorySource({world:watched,id:'5'}));}
  const state=w=>JSON.stringify({t:w.t,people:w.people.map(p=>({x:p.x,z:p.z,needs:p.needs,doing:p.doing,money:p.money})),stats:w.stats,events:w.events});
  expect(state(watched)).toBe(state(control));
 });

 test('seed-matched replays tell the identical story',()=>{
  const stories=[makeWorld(),makeWorld()].map(world=>{world.step(720);return buildLifeStory(readLegacyLifeStorySource({world,id:'0'}));});
  expect(stories[1].factsDigest).toBe(stories[0].factsDigest);
  expect(stories[1].beats.map(b=>b.narration)).toEqual(stories[0].beats.map(b=>b.narration));
 });

 test('a nudge goes through the existing command and its consequences appear in the story',()=>{
  const world=makeWorld();world.step(240); // 10:00, when parks and restaurants are available
  const options=readLegacyLifeStorySource({world,id:'0'}).options;
  expect(options.length).toBeGreaterThan(0);
  const option=chooseNudges(options)[0];
  expect(commandLegacyResident({world,id:'0',option})).toMatchObject({accepted:true,personId:'0'});
  world.step(90);
  const story=buildLifeStory(readLegacyLifeStorySource({world,id:'0'}));
  const asked=story.beats.find(b=>b.type==='USER_COMMAND_ISSUED');
  expect(asked.kind).toBe('influence');
  expect(asked.narration).toStartWith(`You asked ${world.people[0].name} to `);
  const after=story.beats.filter(b=>b.startMinute>=asked.startMinute&&b.kind==='travel');
  expect(after.some(b=>b.narration.endsWith(', as you asked.'))).toBe(true);
  expect(()=>commandLegacyResident({world,id:'0',option:{type:'walk'}})).toThrow('offered activities');
 });

 test('stays fast enough to refresh while the panel is open',()=>{
  const world=makeWorld(80);world.step(600);
  buildLifeStory(readLegacyLifeStorySource({world,id:'0'}));
  const started=performance.now();
  for(let i=0;i<20;i++)buildLifeStory(readLegacyLifeStorySource({world,id:String(i%10)}));
  expect((performance.now()-started)/20).toBeLessThan(40);
 });
});
