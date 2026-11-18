import * as THREE from 'three/webgpu';
import { readFrame, canonical } from './contract.js';
import { createParticleMaterial, intensityColor } from './particle-material.js';
export const PARTICLE_LIMITS=Object.freeze({capacity:24000,defaultCount:18000,drawCalls:1,period:12});
export const PARTICLE_PRESENTATION=Object.freeze({generator:'road-spark-v1',label:'Synthetic demonstration',meaning:'Display lights, never people or trips',distribution:'65% endpoint clusters; 35% road streams; fixed-linear authored road intensity controls color only; zero and missing roads omitted',motion:'Global 6% brightness breathing only; selected cosmetic seconds modulo 12, no historical paths'});
function rng(seed){let s=seed>>>0;return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
function point(path,t){let total=0;const lengths=path.slice(1).map((p,i)=>{const n=Math.hypot(...p.map((v,k)=>v-path[i][k]));total+=n;return n;});let d=t*total;for(let i=0;i<lengths.length;i++){if(d<=lengths[i]||i===lengths.length-1)return path[i].map((v,k)=>v+(path[i+1][k]-v)*(lengths[i]?d/lengths[i]:0));d-=lengths[i];}return [...path[0]];}
export function prepareParticles(input,{metricId,seed=1053,capacity=PARTICLE_LIMITS.defaultCount,expected={}}={}){
 if(!Number.isInteger(seed)||seed<0||seed>0xffffffff||!Number.isInteger(capacity)||capacity<0||capacity>PARTICLE_LIMITS.capacity)throw new RangeError('particle seed/budget');
 const frame=readFrame(input,expected),metric=frame.metrics.find(m=>m.id===metricId);
 if(frame.provenance.kind!=='synthetic-demonstration'||!frame.supportedLayers.includes('particles')||!metric||metric.units!=='synthetic-symbols'||metric.normalization.method!=='fixed-linear'||metric.normalization.min!==0||!(metric.normalization.max>0))throw new TypeError('declared synthetic road intensity required');
 const samples=new Map(frame.samples.filter(s=>s.metricId===metricId).map(s=>[s.targetId,s]));
 let missing=0,zero=0;
 const roads=frame.roads.filter(r=>{const s=samples.get(r.id);if(!s||s.value===null){missing++;return false;}if(s.value===0){zero++;return false;}return true;}).sort((a,b)=>a.id.localeCompare(b.id));
 const random=rng(seed),rows=[];
 // Budget is a cosmetic quality setting, independent of frame population/display counts.
 for(let i=0;roads.length&&i<capacity;i++){
  const road=roads[Math.floor(random()*roads.length)],cluster=random()<.65;
  const t=cluster?(random()<.5?random()**3*.16:1-random()**3*.16):random();
  const p=point(road.path,t),angle=random()*Math.PI*2,spread=cluster?9:3;
  p[0]+=Math.cos(angle)*random()*spread;p[2]+=Math.sin(angle)*random()*spread;p[1]+=1+random()*3;
  const value=samples.get(road.id).value,normalized=value/metric.normalization.max;
  rows.push(Object.freeze({roadId:road.id,position:Object.freeze(p),size:.65+random()*1.25,color:Object.freeze(intensityColor(normalized)),value}));
 }
 return Object.freeze({frame,metric,seed,rows:Object.freeze(rows),missing,zero,presentation:PARTICLE_PRESENTATION});
}
/** Host owns rendering, camera and scheduling. No model writes, timers or RAF. */
export function mountParticles({scene,renderer,frame,metricId,reducedMotion=false,...options}){
 if(!scene?.isScene||!renderer)throw new TypeError('scene and renderer required');
 let data=prepareParticles(frame,{metricId,...options}),mesh=null,shader=null,disposed=false,lost=false,initialized=false,enabled=true,time=0;
 const pins={identity:data.frame.identity,coordinates:data.frame.coordinates,clock:data.frame.clock};
 const matrix=new THREE.Matrix4(),q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2),position=new THREE.Vector3(),scale=new THREE.Vector3(),color=new THREE.Color();
 function release(){if(!mesh)return;scene.remove(mesh);mesh.dispose();mesh.geometry.dispose();mesh.material.dispose();mesh=null;shader=null;}
 function paint(){
  if(!initialized||disposed||lost||!enabled||!data.rows.length)return;
  if(!mesh){shader=createParticleMaterial();mesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),shader.material,options.capacity??PARTICLE_LIMITS.defaultCount);mesh.name='Synthetic demonstration particles';mesh.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(mesh.instanceMatrix.count*3),3);scene.add(mesh);}
  data.rows.forEach((r,i)=>{position.set(...r.position);scale.set(r.size*4,r.size*4,1);matrix.compose(position,q,scale);mesh.setMatrixAt(i,matrix);color.setRGB(...r.color);mesh.setColorAt(i,color);});
  mesh.count=data.rows.length;mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();shader.phase.value=(reducedMotion?0:time%12)*Math.PI/6;
 }
 const ready=Promise.resolve().then(()=>renderer.init?.()).then(()=>{if(disposed)return false;initialized=true;renderer.backend?.device?.lost?.then(()=>{if(!disposed){lost=true;release();}});paint();return true;}).catch(()=>{lost=true;release();return false;});
 const api={ready,update(next){if(disposed||lost)throw new Error('particles unavailable');const candidate=prepareParticles(next,{metricId,...options,expected:{...options.expected,...pins}});data=candidate;paint();return api.stats();},
 setTime(seconds){if(!Number.isFinite(seconds)||seconds<0)throw new RangeError('cosmetic seconds');if(disposed||lost)return false;time=seconds;if(shader)shader.phase.value=(reducedMotion?0:time%12)*Math.PI/6;return true;},
 setEnabled(value){if(disposed||lost)return false;enabled=Boolean(value);if(enabled)paint();else release();return enabled;},
 stats(){const arrays=mesh?[mesh.instanceMatrix.array,mesh.instanceColor.array,...Object.values(mesh.geometry.attributes).map(a=>a.array),mesh.geometry.index.array]:[];return {state:disposed?'disposed':lost?'device-lost':!initialized?'initializing':enabled?'ready':'disabled',count:mesh?.count??0,capacity:options.capacity??PARTICLE_LIMITS.defaultCount,drawCalls:mesh?1:0,allocatedBufferBytes:arrays.reduce((n,a)=>n+a.byteLength,0),cosmeticSeconds:time,phase:reducedMotion?0:time%12,reducedMotion,missing:data.missing,zero:data.zero};},
 get data(){return data;},dispose(){if(disposed)return;disposed=true;release();}};return api;
}
