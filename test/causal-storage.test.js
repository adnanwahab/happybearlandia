import {test,expect} from 'bun:test';
import {Database} from 'bun:sqlite';
import {createCausalStore,causalContentHash} from '../shared/causality/storage.js';
const context={universeId:'universe:test:1',worldId:'world:test:1',scenarioId:'scenario:test:1',runId:'run:test:1',seed:1,modelVersion:'v1',tick:0};
const provenance={id:'provenance:test:1',kind:'simulated',source:'test',modelVersion:'v1',sourceIds:[]};
const event=(n,tick=n)=>({id:`event:test:${n}`,context:{...context,tick},sequence:n,type:'step',entityIds:[],payload:{n},provenance});
const edge=(n,from,to,relation='causes')=>({id:`edge:test:${n}`,context,fromId:from,toId:to,relation,confidence:1,evidenceIds:[],provenance});
function setup(){const db=new Database(':memory:');return {db,store:createCausalStore(db)};}
test('atomic rollback, same run references, unique sequences, time ordered DAG and associations',()=>{
 const {db,store:s}=setup();s.createRun(context);
 s.commitStep(context.runId,{expectedRevision:0,events:[event(0),event(1)]});
 expect(()=>s.commitStep(context.runId,{expectedRevision:1,events:[event(2)],edges:[edge(0,'event:test:2','event:test:missing')]})).toThrow();
 expect(s.getNode(context.runId,'event:test:2')).toBeNull();expect(s.getRun(context.runId).revision).toBe(1);
 expect(()=>s.commitStep(context.runId,{expectedRevision:1,events:[{...event(2),sequence:1}]})).toThrow();
 expect(()=>s.commitStep(context.runId,{expectedRevision:1,events:[{...event(2),context:{...context,runId:'run:test:other'}}]})).toThrow();
 expect(()=>s.commitStep(context.runId,{expectedRevision:1,edges:[edge(0,'event:test:1','event:test:0')]})).toThrow();
 s.commitStep(context.runId,{expectedRevision:1,edges:[edge(0,'event:test:0','event:test:1'),edge(1,'event:test:1','event:test:0','correlates')]});
 expect(s.listEdges(context.runId,{association:true}).items).toHaveLength(1);db.close();
});
test('bounded pagination, hashes, checkpoint verification and terminal immutability',()=>{
 const {db,store:s}=setup();s.createRun(context);
 const state={z:2,a:[1]};
 s.commitStep(context.runId,{expectedRevision:0,events:[event(0),event(1),event(2)],checkpoints:[{id:'checkpoint:test:0',context,sequence:0,state,hash:causalContentHash(state),replayMode:'recorded'}]});
 const first=s.listEvents(context.runId,{limit:2});expect(first.nextCursor).toBe(1);expect(s.listEvents(context.runId,{afterSequence:first.nextCursor}).items.map(x=>x.sequence)).toEqual([2]);
 expect(first.items[0].contentHash).toBe(causalContentHash(event(0)));expect(causalContentHash({a:1,b:2})).toBe(causalContentHash({b:2,a:1}));
 const done=s.completeRun(context.runId,{expectedRevision:1});expect(done.contentHash).toMatch(/^[a-f0-9]{64}$/);
 expect(()=>s.commitStep(context.runId,{expectedRevision:2,events:[event(3)]})).toThrow();
 expect(()=>db.query('DELETE FROM causal_nodes WHERE run_id=?').run(context.runId)).toThrow();
 expect(()=>db.query("UPDATE causal_runs SET status='running' WHERE id=?").run(context.runId)).toThrow();
 createCausalStore(db);expect(s.listEvents(context.runId).items).toHaveLength(3);db.close();
});
test('observations and assumptions share ordered sequence; malformed commits cannot partially save',()=>{
 const {db,store:s}=setup();s.createRun(context);
 const assumption={id:'assumption:test:0',context,sequence:0,label:'baseline',value:1,rationale:'test',provenance};
 const observation={id:'observation:test:1',context:{...context,tick:1},sequence:1,entityId:'entity:test:1',metricId:'metric:test:1',value:2,unit:'count',provenance};
 s.commitStep(context.runId,{expectedRevision:0,assumptions:[assumption],observations:[observation],edges:[edge(0,assumption.id,observation.id)]});
 expect(s.listAssumptions(context.runId).items[0].sequence).toBe(0);expect(s.listObservations(context.runId).items[0].sequence).toBe(1);
 expect(()=>s.commitStep(context.runId,{expectedRevision:1,events:[event(2,0)]})).toThrow();
 expect(()=>s.commitStep(context.runId,{expectedRevision:1,events:[event(2)],checkpoints:[{id:'checkpoint:test:bad',context,sequence:2,state:{},hash:'bad',replayMode:'recorded'}]})).toThrow();
 expect(s.getNode(context.runId,event(2).id)).toBeNull();
 s.createRun({...context,runId:'run:test:2'});
 expect(()=>s.commitStep('run:test:2',{expectedRevision:0,edges:[{...edge(1,assumption.id,observation.id),context:{...context,runId:'run:test:2'}}]})).toThrow();db.close();
});
test('additive migration and complete causal data survive file reopen with metadata',async()=>{
 const {mkdtempSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const dir=mkdtempSync(join(tmpdir(),'hbl-causal-'));const path=join(dir,'world.sqlite');
 try{let db=new Database(path);db.exec('CREATE TABLE world_state(id TEXT PRIMARY KEY); INSERT INTO world_state VALUES(\'original\')');let s=createCausalStore(db);
 s.createRun({context,metadata:{manifest:{version:'test-v1'}}});s.commitStep(context.runId,{expectedRevision:0,events:[event(0)]});const hash=s.completeRun(context.runId,{expectedRevision:1}).contentHash;db.close();
 db=new Database(path);s=createCausalStore(db);expect(s.getRun(context.runId).contentHash).toBe(hash);expect(s.getRun(context.runId).metadata.manifest.version).toBe('test-v1');expect(s.getNode(context.runId,event(0).id).payload).toEqual({n:0});expect(db.query('SELECT id FROM world_state').get().id).toBe('original');db.close();
 }finally{rmSync(dir,{recursive:true,force:true});}
});
