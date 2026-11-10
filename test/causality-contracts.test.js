import {test,expect} from 'bun:test';
import * as C from '../shared/causality/index.js';
const id=(kind,local)=>C.canonicalId(kind,'test',local);
const context={universeId:id('universe','1'),worldId:id('world','1'),scenarioId:id('scenario','1'),runId:id('run','1'),seed:42,modelVersion:'v1',tick:2};
const provenance={id:id('provenance','1'),kind:'simulated',source:'test',modelVersion:'v1',sourceIds:[]};
test('canonical encoding and explicit local mappings',()=>{
 const value=id('person','a:b /☃'); expect(C.parseCanonicalId(value).localId).toBe('a:b /☃');
 expect(()=>C.parseCanonicalId('person:test:%61')).toThrow();
 const map=C.createLocalIdMap(); expect(map.resolve('person','test','a')).toBeNull();
 map.register({kind:'person',namespace:'test',localId:'a',canonicalId:id('person','a')}); expect(map.local(id('person','a'))).toBe('a');
 expect(()=>map.register({kind:'person',namespace:'test',localId:'b',canonicalId:id('person','a')})).toThrow();
});
test('strict run validation rejects extra keys, invalid numbers, and clones input',()=>{
 expect(C.RunContextSchema.parse(context)).toEqual(context);
 for(const patch of [{tick:NaN},{seed:-1},{extra:true},{runId:'local'}]) expect(C.RunContextSchema.safeParse({...context,...patch}).success).toBe(false);
 const copy=C.RunContextSchema.parse(context); copy.tick=99; expect(context.tick).toBe(2);
});
test('metric registry rejects duplicates and incompatible observation units',()=>{
 const metric={id:id('metric','wage'),label:'Wage',unit:'USD/hour',aggregation:'mean'};
 const registry=C.createMetricRegistry([metric]);
 const row={id:id('observation','1'),context,sequence:0,entityId:id('person','1'),metricId:metric.id,value:20,unit:metric.unit,provenance};
 expect(registry.validateObservation(row)).toEqual(row);
 expect(()=>registry.validateObservation({...row,unit:'USD'})).toThrow(); expect(()=>registry.register(metric)).toThrow();
});
test('interventions fail closed for stale scope, arbitrary actions and extra parameters',()=>{
 const input={id:id('intervention','1'),context,action:'set-wage',targetId:id('person','1'),parameters:{wage:25}};
 const rules=[{action:'set-wage',targetKinds:['person'],parameters:{wage:{type:'number',min:0,max:100}}}];
 expect(C.validateIntervention(input,rules,context)).toEqual(input);
 for(const change of [{action:'eval'},{parameters:{wage:101}},{parameters:{wage:25,code:'x'}},{context:{...context,tick:1}},{targetId:id('world','1')}]) expect(()=>C.validateIntervention({...input,...change},rules,context)).toThrow();
 expect(()=>C.validateIntervention(input,[],context)).toThrow();
});
test('iframe envelopes reject spoofed origins, sources, versions, and types',()=>{
 const source={}, navigation={universeId:context.universeId,worldId:context.worldId,scenarioId:context.scenarioId};
 const data={version:1,channel:C.IFRAME_CHANNEL,requestId:'r1',context:navigation,type:'navigate',experienceId:'city'};
 const event={origin:'https://example.com',source,data};
 expect(C.parseIframeEvent(event,{origin:event.origin,source})).toEqual(data);
 for(const expected of [{origin:'*',source},{origin:event.origin,source:{}}]) expect(()=>C.parseIframeEvent(event,expected)).toThrow();
 for(const patch of [{version:2},{type:'execute'},{code:'x'}]) expect(C.IframeMessageSchema.safeParse({...data,...patch}).success).toBe(false);
});
test('navigation roundtrips optional branch/time/selection without ambiguous ticks',()=>{
 const value={universeId:context.universeId,worldId:context.worldId,scenarioId:context.scenarioId,runId:context.runId,branchId:id('branch','x'),tick:0,entityId:id('person','a/b')};
 expect(C.decodeNavigationContext(C.encodeNavigationContext(value))).toEqual(value);
 expect(()=>C.decodeNavigationContext(C.encodeNavigationContext(value)+'&tick=1')).toThrow();
 expect(()=>C.decodeNavigationContext(C.encodeNavigationContext(value).replace('tick=0','tick=01'))).toThrow();
});
test('snapshots reject mixed runs and duplicate records; JSON rejects unsafe structures',()=>{
 const row={id:id('event','1'),context,sequence:0,type:'test',entityIds:[],payload:{ok:true},provenance};
 const snapshot={context,events:[row],observations:[],assumptions:[],edges:[]};
 expect(C.CausalSnapshotSchema.parse(snapshot)).toEqual(snapshot);
 expect(()=>C.CausalSnapshotSchema.parse({...snapshot,events:[row,row]})).toThrow();
 expect(()=>C.CausalSnapshotSchema.parse({...snapshot,context:{...context,runId:id('run','2')}})).toThrow();
 expect(()=>C.EventSchema.parse({...row,payload:new Date()})).toThrow();
 expect(()=>C.EventSchema.parse({...row,payload:JSON.parse('{"__proto__":1}')})).toThrow();
});
