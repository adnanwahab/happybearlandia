import {test,expect} from 'bun:test';
import * as THREE from 'three';
import {Database} from 'bun:sqlite';
import {createCausalStore} from '../shared/causality/storage.js';
import {createCausalityReadHandler} from '../world/causality/read-api.js';
import {projectEvidencePath,INPUT_LIMIT} from '../world/evidence-path/project.js';
import {evidencePathFixture} from '../world/evidence-path/fixture.js';
import {createEvidencePathLayer} from '../world/evidence-path/layer.js';
const project=f=>projectEvidencePath(f.data,f.mapping,'synthetic-evidence-stage.v1');

test('fixture uses persisted causal contracts and the real read endpoint, preserving exact IDs',async()=>{
  const f=evidencePathFixture(),db=new Database(':memory:'),store=createCausalStore(db),context=f.mapping.context;
  try{
    store.createRun(context);store.commitStep(context.runId,{expectedRevision:0,events:f.data.nodes,edges:f.data.edges});store.completeRun(context.runId,{expectedRevision:1});
    const handle=createCausalityReadHandler({store});
    const response=await handle(new Request('http://localhost/api/causality/explain?'+new URLSearchParams({runId:context.runId,targetId:f.data.targetId})));
    expect(response.status).toBe(200);const data=await response.json();
    const result=projectEvidencePath(data,f.mapping,f.mapping.frameId);
    expect(result.segments.map(s=>s.kind)).toEqual(['segment','jump','jump']);
    expect(result.segments[0].eventIds).toEqual(['event:evidence:0','event:evidence:1']);
    expect(result.segments[0].evidenceIds).toEqual(['event:evidence:0']);
    expect(result.records).toHaveLength(4);
    expect(result).toEqual(projectEvidencePath({...data,nodes:[...data.nodes].reverse(),edges:[...data.edges].reverse()},f.mapping,f.mapping.frameId));
  }finally{db.close();}
});

test('repeat projection leaves versioned input unchanged and never bridges nonspatial nodes',()=>{
  const f=evidencePathFixture(),before=JSON.stringify(f),a=project(f);
  expect(project(f)).toEqual(a);expect(JSON.stringify(f)).toBe(before);
  expect(a.segments.filter(s=>s.kind==='segment')).toHaveLength(1);
  expect(a.segments.slice(1).every(s=>s.reason.includes('Jump'))).toBe(true);
});

test('scope/frame mismatches and invalid coordinates become jumps, never guessed locations',()=>{
  for(const mutate of [f=>f.mapping.frameId='other',f=>f.mapping.context.runId='run:other:1',f=>f.mapping.context.worldId='world:other:1',f=>f.mapping.context.seed=1,f=>f.mapping.anchors[0].x=NaN,f=>f.mapping.anchors[0].x='0',f=>f.mapping.anchors[0].z=100001,f=>delete f.mapping.anchors[0].provenance]){
    const f=evidencePathFixture();mutate(f);expect(project(f).segments[0].kind).toBe('jump');
  }
  const f=evidencePathFixture();expect(projectEvidencePath(f.data,null,null).segments.every(s=>s.kind==='jump')).toBe(true);
  f.mapping.frameId=null;expect(projectEvidencePath(f.data,f.mapping,null).segments.every(s=>s.kind==='jump')).toBe(true);
  f.mapping.frameId='synthetic-evidence-stage.v1';
  f.mapping.anchors.push(f.mapping.anchors[0]);expect(project(f).notices).toContain('Duplicate event locations.');
});

test('missing citations, cross-run edges, correlations and reversed time do not create paths',()=>{
  for(const mutate of [f=>f.data.evidence=[],f=>f.data.edges.forEach(e=>e.relation='correlates'),f=>f.data.edges.forEach(e=>e.context.runId='run:other:1'),f=>f.data.edges.forEach(e=>e.toId='event:missing:1'),f=>f.data.nodes[0].context.tick=100]){
    const f=evidencePathFixture();mutate(f);const result=project(f);expect(result.segments.some(s=>s.id==='edge:evidence:0')).toBe(false);expect(result.notices.length).toBeGreaterThan(0);
  }
});

test('limits, incomplete histories, isolated records and non-event nodes are explicit',()=>{
  const f=evidencePathFixture();f.data.incomplete=true;f.data.reasons=['depth-limit'];
  f.data.nodes.push({...f.data.nodes[0],id:'assumption:evidence:nonspatial',type:undefined});
  expect(project(f).records).toHaveLength(5);expect(project(f).notices[0]).toContain('depth-limit');
  f.data.nodes=Array.from({length:INPUT_LIMIT+1},()=>f.data.nodes[0]);expect(project(f).segments).toEqual([]);
  const empty=evidencePathFixture();empty.data.edges=[];expect(project(empty).notices).toContain('No supported recorded event connections available.');
});

test('ground objects carry exact IDs; repeated replacement and skip dispose every allocation',()=>{
  const scene=new THREE.Scene(),layer=createEvidencePathLayer({THREE,scene}),report=project(evidencePathFixture());
  for(let i=0;i<4;i++){
    layer.show(report);expect(scene.children).toHaveLength(1);expect(layer.stats().objects).toBe(3);
    const resources=[];scene.traverse(o=>{for(const r of [o.geometry,o.material])if(r){let calls=0;r.addEventListener('dispose',()=>calls++);resources.push(()=>calls);}});
    expect(scene.children[0].children.every(o=>o.userData.edgeId==='edge:evidence:0')).toBe(true);
    layer.clear();expect(scene.children).toHaveLength(0);expect(resources.every(c=>c()===1)).toBe(true);
  }
  expect(layer.stats().disposedResources).toBe(24);layer.destroy();expect(scene.children).toHaveLength(0);
});

test('branch preview is bounded, stable under edge reordering, and never repeats traversal indefinitely',()=>{
  const f=evidencePathFixture(),template=f.data.nodes[0],context=template.context;
  f.data.nodes=Array.from({length:40},(_,i)=>({...template,id:`event:evidence:${i}`,context:{...context,tick:i},sequence:i}));
  f.data.edges=f.data.nodes.slice(1).map((n,i)=>({...f.data.edges[0],id:`edge:evidence:${i}`,context:{...context,tick:i+1},fromId:f.data.nodes[i].id,toId:n.id,evidenceIds:[f.data.nodes[i].id]}));
  f.data.evidence=f.data.nodes;f.data.targetId=f.data.nodes.at(-1).id;
  const result=project(f);expect(result.segments).toHaveLength(32);expect(result.notices).toContain('Path preview limited to 32 recorded connections.');
  expect(project({...f,data:{...f.data,edges:[...f.data.edges].reverse()}})).toEqual(result);
  const cycle=evidencePathFixture();cycle.data.nodes.forEach(n=>n.context.tick=0);
  cycle.data.edges.push({...cycle.data.edges[0],id:'edge:evidence:cycle',fromId:cycle.data.nodes[3].id,toId:cycle.data.nodes[0].id,evidenceIds:[cycle.data.nodes[3].id]});
  expect(project(cycle).segments).toHaveLength(4);
});
