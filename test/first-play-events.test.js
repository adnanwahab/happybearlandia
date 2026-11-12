import { test, expect } from 'bun:test';
import { FIRST_PLAY_SCHEMA_VERSION, FIRST_PLAY_CURRENT_SCHEMA_VERSION, FIRST_PLAY_EVENT_TYPES, createFirstPlaySessionId, validateFirstPlayEvent } from '../world/first-play-events.js';
const payloads = {
  landing: {entry:'direct'}, demo_start: {mode:'fresh'}, first_input: {control:'policy'},
  first_divergence: {facts:{source:'recorded-paired-history',modelVersion:'city-systems.1.0.0',dataVersion:'future-machine.v1',seed:42,month:1,scenario:'plan',synthetic:true}},
  why_opened:{target:'recorded-event'}, share:{method:'copy',result:'succeeded'}, return:{entry:'resume'},
};
const event = type => ({schemaVersion:FIRST_PLAY_SCHEMA_VERSION,type,sessionId:'fps_0123456789abcdef0123456789abcdef',elapsedMs:0,payload:structuredClone(payloads[type])});
const rejects = value => expect(validateFirstPlayEvent(value).ok).toBe(false);
for (const type of FIRST_PLAY_EVENT_TYPES) {
  test(`${type}: exact payload accepted; missing, extra and sensitive fields rejected`, () => {
    expect(validateFirstPlayEvent(event(type))).toEqual({ok:true});
    for (const key of Object.keys(payloads[type])) {
      const missing = event(type); delete missing.payload[key]; rejects(missing);
      for (const value of ['person@example.com','https://example.test/?token=secret','Bearer secret','Alice', 'x'.repeat(2048), null, {}, []]) {
        const invalid = event(type); invalid.payload[key] = value; rejects(invalid);
      }
    }
    for (const key of ['email','name','url','token','password','prompt','scenarioId','extra','__proto__']) {
      const invalid = event(type); Object.defineProperty(invalid.payload,key,{value:'sensitive',enumerable:true}); rejects(invalid);
    }
  });
}
test('envelope rejects versions, unknown types, identifiers and arbitrary fields', () => {
  for (const patch of [{schemaVersion:'hbl.first-play.v3'},{type:'unknown'},{type:'__proto__'},{sessionId:'person@example.com'},{sessionId:'fps_123'}, {sessionId:'https://example.test/?token=secret'},{elapsedMs:-1},{elapsedMs:Infinity},{elapsedMs:86400001},{elapsedMs:0.5},{url:'secret'}]) rejects({...event('landing'),...patch});
  for (const value of [null,[],{},'text',undefined]) rejects(value);
  for (const key of Object.keys(event('landing'))) {const value=event('landing');delete value[key];rejects(value);}
});
test('model references are bounded and never contain arbitrary outcomes', () => {
  for (const patch of [{month:0},{month:121},{seed:-1},{seed:4294967296},{modelVersion:'token-secret'},{dataVersion:'unknown'},{synthetic:false},{scenario:'person-name'},{source:'inferred'},{outcome:123}]) {
    const value=event('first_divergence');Object.assign(value.payload.facts,patch);rejects(value);
  }
  const value=event('first_divergence');value.payload.facts.seed=4294967295;value.payload.facts.month=120;
  expect(validateFirstPlayEvent(value)).toEqual({ok:true});
});
test('rejects hidden properties, symbols, getters, cycles and custom prototypes without reading getters', () => {
  const value=event('landing');Object.defineProperty(value.payload,'entry',{get(){throw new Error('must not run');},enumerable:true});rejects(value);
  for (const payload of [Object.create({entry:'direct'}),{entry:'direct',[Symbol('secret')]:'secret'}]) rejects({...event('landing'),payload});
  const hidden=event('landing');Object.defineProperty(hidden,'secret',{value:'secret'});rejects(hidden);
  const cycle=event('landing');cycle.payload.entry=cycle;rejects(cycle);
  const proxy=new Proxy({}, {ownKeys(){throw new Error('private');}});
  expect(validateFirstPlayEvent(proxy)).toEqual({ok:false,code:'INVALID_EVENT'});
});
test('secure anonymous IDs are distinct and usable without a browser', () => {
  const ids=new Set(Array.from({length:100},()=>createFirstPlaySessionId()));expect(ids.size).toBe(100);
  for(const sessionId of ids) expect(validateFirstPlayEvent({...event('landing'),sessionId})).toEqual({ok:true});
});

test('current City facts require explicit v2 while legacy v1 keeps its model boundary', () => {
  const legacy=event('first_divergence');
  expect(validateFirstPlayEvent(legacy)).toEqual({ok:true});
  const current=structuredClone(legacy);current.schemaVersion=FIRST_PLAY_CURRENT_SCHEMA_VERSION;current.payload.facts.modelVersion='city-systems.1.1.0';
  expect(validateFirstPlayEvent(current)).toEqual({ok:true});
  rejects({...current,schemaVersion:FIRST_PLAY_SCHEMA_VERSION});
  rejects({...legacy,schemaVersion:FIRST_PLAY_CURRENT_SCHEMA_VERSION});
});
