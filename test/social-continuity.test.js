import {describe,test,expect} from 'bun:test';
import {canonicalId,NavigationContextSchema} from '../shared/causality/index.js';
import {characterFromPerson,validateCharacter,characterKey,createContinuityStore} from '../world/social/continuity.js';
import {contextURL,contextFromURL} from '../world/universe/navigation.js';
const id=(kind,local)=>canonicalId(kind,'fixture',local);
const context={universeId:id('universe','main'),worldId:id('world','houston'),scenarioId:id('scenario','baseline'),runId:id('run','one'),branchId:id('branch','private'),tick:12};
const person={personId:'seed42-p0',name:'Resident A',householdId:'seed42-h0',homeId:'home0',locationId:'loc9',employment:{jobId:'bakery:assignment:0'},schedule:{template:'worker',offsetMinutes:5},social:{ties:[{targetId:'seed42-p1',trust:.8}]},needs:{energy:60},commuteMinutes:22,journal:{text:'Imagined memory'}};
const character=(ctx=context)=>characterFromPerson(person,{source:'living-city',context:ctx});
const storage=()=>{const values=new Map([['existing-household-save','untouched'],['act-normal-session','room-token']]);return{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),values};};
describe('social character continuity',()=>{
 test('maps explicit IDs and preserves source schedules without mutating a person',()=>{const c=character();expect(c.personId).toBe(canonicalId('person','living-city',`${context.worldId}/${person.personId}`));expect(c.jobId).toContain('job:living-city:');expect(c.context.tick).toBe(12);c.schedule.offsetMinutes=99;expect(person.schedule.offsetMinutes).toBe(5);expect(c.evidence).toBe('synthetic');expect(c.narrative.text).toBe('Imagined memory');});
 test('unknown mappings remain unknown and worlds never collide',()=>{const c=characterFromPerson({id:0,name:'Saved person',rel:{friend:'F'}},{source:'inner-lives',context});expect(c.homeId).toBeNull();expect(c.measured).toBeNull();expect(c.evidence).toBe('fictional');expect(character({...context,worldId:id('world','other')}).personId).not.toBe(character().personId);});
 test('exact branch/run/tick handoffs survive all experience URLs',()=>{const c=character();for(const route of ['/world?living=1','/tools/inner-lives.html','/game','/world/party/act-normal.html','/tools/world-line-talk.html']){const query=contextFromURL(contextURL(route,c.context));expect(query).toEqual(c.context);NavigationContextSchema.parse(query);}});
 test('private memories stay scoped and cannot overwrite saved households or rooms',()=>{const backing=storage(),store=createContinuityStore(backing),c=store.save(character());const fork=store.save(character({...context,branchId:id('branch','another')}));store.record(c,{experience:'game',text:'Visited the bakery'});expect(store.references(fork)).toHaveLength(0);expect(store.references(c)[0]).toMatchObject({evidence:'fictional',simulationEffect:false,sourceRecordId:null});expect(store.find(fork.context)).toEqual(fork);expect(backing.getItem('existing-household-save')).toBe('untouched');expect(backing.getItem('act-normal-session')).toBe('room-token');expect(characterKey(fork)).not.toBe(characterKey(c));expect(store.find({...c.context,tick:13})).toBeNull();const {branchId,...withoutBranch}=c.context;expect(store.find(withoutBranch)).toBeNull();});
 test('tampered identities and unsupported narrative sources are rejected',()=>{const c=character(),store=createContinuityStore(storage());expect(()=>validateCharacter({...c,localId:'different'})).toThrow();expect(()=>store.record(c,{experience:'twitch',text:'hi'})).toThrow();expect(()=>characterFromPerson(person,{source:'game',context})).toThrow();expect(()=>store.record(c,{experience:'game',text:'hi',sourceRecordId:'unverified'})).toThrow();});
});

test('actual population inspection exports location IDs and calculated schedules',async()=>{
 const {createPopulationModel,inspectPerson}=await import('../world/population/model.js');
 const model=createPopulationModel({population:12,seed:42},{buildings:[{id:'bakery-block',center:[0,0],kind:'commercial'},{id:'residential-block',center:[50,0],kind:'residential'}]});
 const row=inspectPerson(model,`${model.prefix}-p0`,{track:false});
 const c=characterFromPerson(row,{source:'living-city',context,tick:model.tick});
 expect(c.homeId).toBe(canonicalId('home','living-city',`${context.worldId}/${model.locations[model.people.homeLocation[0]].id}`));
 expect(c.locationId).toBe(canonicalId('location','living-city',`${context.worldId}/${model.locations[model.people.currentLocation[0]].id}`));
 expect(c.schedule).toEqual(row.schedule);expect(c.relationships).toEqual(row.social);expect(c.context.tick).toBe(0);
});
