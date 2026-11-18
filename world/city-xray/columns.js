import * as THREE from 'three/webgpu';
import { readFrame, canonical } from './contract.js';
import { intensityColor, createColumnMaterials } from './columns-material.js';
export const COLUMN_LIMITS=Object.freeze({capacity:8192,samplesPerRoad:8,maxHeight:108,width:.42,haloWidth:2.8,drawCalls:2});
const finitePositive=(n,name)=>{if(!Number.isFinite(n)||n<=0)throw new RangeError(name);return n;};
export function mapColumnValue(value,metric,maxHeight=COLUMN_LIMITS.maxHeight) {
 finitePositive(maxHeight,'display height');
 if(metric?.normalization?.method!=='fixed-linear'||metric.normalization.min!==0||!Number.isFinite(metric.normalization.max)||metric.normalization.max<=0||!['synthetic-symbols','residents','encounters'].includes(metric.units))throw new TypeError('declared frame scale/units required');
 if(value===null)return null;
 if(!Number.isFinite(value)||value<0||value>metric.normalization.max)throw new RangeError('value outside declared scale');
 const normalized=value/metric.normalization.max;
 return {normalized,height:normalized*maxHeight,color:intensityColor(normalized),units:metric.units};
}
function along(path,t) {
 const lengths=path.slice(1).map((p,i)=>Math.hypot(...p.map((v,k)=>v-path[i][k]))),total=lengths.reduce((a,b)=>a+b,0);
 if(!total)throw new TypeError('zero length road');
 let distance=t*total;
 for(let i=0;i<lengths.length;i++){if(distance<=lengths[i]||i===lengths.length-1){const f=lengths[i]?distance/lengths[i]:0;return path[i].map((v,k)=>v+(path[i+1][k]-v)*f);}distance-=lengths[i];}
}
/** Multiple presentation shafts reference one road measurement; they are not extra observations. */
export function prepareColumns(input,{metricId,expected={},capacity=COLUMN_LIMITS.capacity,samplesPerRoad=COLUMN_LIMITS.samplesPerRoad,maxHeight=COLUMN_LIMITS.maxHeight,width=COLUMN_LIMITS.width}={}) {
 if(!Number.isInteger(capacity)||capacity<0||capacity>COLUMN_LIMITS.capacity||!Number.isInteger(samplesPerRoad)||samplesPerRoad<1||samplesPerRoad>16)throw new RangeError('column budget');
 finitePositive(width,'width');if(width>1)throw new RangeError('thin width <=1 model-unit');
 const frame=readFrame(input,expected),metric=frame.metrics.find(m=>m.id===metricId);
 if(!metric||!frame.supportedLayers.includes('columns'))throw new TypeError('columns metric/layer unavailable');
 mapColumnValue(null,metric,maxHeight);
 const roads=new Map(frame.roads.map(r=>[r.id,r])),rows=[];
 const budget=Math.min(capacity,frame.display.maxColumns);
 let missing=0,zero=0,eligible=0;
 for(const s of frame.samples.filter(s=>s.metricId===metricId).sort((a,b)=>a.targetId.localeCompare(b.targetId))){
  const road=roads.get(s.targetId);if(!road)continue;
  const mapped=mapColumnValue(s.value,metric,maxHeight);
  if(!mapped){missing++;continue;}if(s.value===0)zero++;
  for(let ordinal=0;ordinal<samplesPerRoad;ordinal++){
   eligible++;if(rows.length>=budget)continue;
   const fraction=(ordinal+.5)/samplesPerRoad;
   rows.push(Object.freeze({id:JSON.stringify([frame.identity.run.id,metricId,road.id,ordinal]),roadId:road.id,sampleId:JSON.stringify([metricId,road.id]),ordinal,fraction,position:Object.freeze(along(road.path,fraction)),value:s.value,...mapped,color:Object.freeze(mapped.color),runId:s.runId,clock:frame.clock,metricId}));
  }
 }
 return Object.freeze({frame,metric,rows:Object.freeze(rows),missing,zero,omitted:eligible-rows.length,width,maxHeight});
}
/** Host owns scene, renderer, camera and scheduling. This module never creates a render loop. */
export function mountColumns({scene,renderer,frame,metricId,...options}) {
 if(!scene?.isScene||!renderer)throw new TypeError('scene and renderer required');
 let data=prepareColumns(frame,{metricId,...options}),disposed=false,enabled=true,lost=false,meshes=[],geometries=[],materials=[],device=null;
 const pins={identity:data.frame.identity,coordinates:data.frame.coordinates};
 const matrix=new THREE.Matrix4(),color=new THREE.Color();
 const capacity=Math.min(options.capacity??COLUMN_LIMITS.capacity,data.frame.display.maxColumns);
 let visibleRows=[];
 function release(){for(const mesh of meshes){scene.remove(mesh);mesh.dispose();}geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());meshes=[];geometries=[];materials=[];visibleRows=[];}
 function allocate(){
  if(disposed||lost||!enabled||meshes.length||capacity===0)return;
  const m=createColumnMaterials();materials=[m.core,m.halo];
  geometries=[new THREE.BoxGeometry(1,1,1),new THREE.PlaneGeometry(1,1)];
  meshes=geometries.map((g,i)=>{const mesh=new THREE.InstancedMesh(g,materials[i],capacity);mesh.name=i?'City X-Ray column halo':'City X-Ray thin columns';mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(capacity*3),3);scene.add(mesh);return mesh;});
 }
 function paint({camera=null,maxDistance=Infinity,stride=1}={}){
  if(!Number.isInteger(stride)||stride<1||stride>16||!(maxDistance>=0))throw new RangeError('quality/culling');
  allocate();if(!meshes.length)return;
  const frustum=camera?new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),camera.coordinateSystem):null;
  visibleRows=data.rows.filter((r,i)=>i%stride===0&&(!camera||(camera.position.distanceTo(new THREE.Vector3(...r.position))<=maxDistance&&frustum.intersectsBox(new THREE.Box3(new THREE.Vector3(r.position[0]-2,r.position[1],r.position[2]-2),new THREE.Vector3(r.position[0]+2,r.position[1]+r.height,r.position[2]+2))))));
  for(let i=0;i<visibleRows.length;i++){
   const r=visibleRows[i];color.setRGB(...r.color);matrix.makeScale(data.width,r.height,data.width);matrix.setPosition(r.position[0],r.position[1]+r.height/2,r.position[2]);meshes[0].setMatrixAt(i,matrix);meshes[0].setColorAt(i,color);
   matrix.identity();if(camera)matrix.makeRotationY(Math.atan2(camera.position.x-r.position[0],camera.position.z-r.position[2]));matrix.scale(new THREE.Vector3(COLUMN_LIMITS.haloWidth,r.height,1));matrix.setPosition(r.position[0],r.position[1]+r.height/2,r.position[2]);meshes[1].setMatrixAt(i,matrix);meshes[1].setColorAt(i,color);
  }
  meshes.forEach(m=>{m.count=visibleRows.length;m.instanceMatrix.needsUpdate=true;m.instanceColor.needsUpdate=true;m.computeBoundingSphere();});
 }
 const ready=Promise.resolve(renderer.init?.()).then(()=>{
  if(disposed)return false;device=renderer.backend?.device;
  device?.lost?.then(()=>{if(disposed)return;lost=true;release();});
  paint();return true;
 }).catch(()=>{lost=true;release();return false;});
 const api={ready,update(next,view={}){
  if(disposed||lost)throw new Error('columns unavailable');
  const candidate=prepareColumns(next,{metricId,...options,capacity,expected:{...options.expected,...pins}});
  if(candidate.frame.clock.authority!==data.frame.clock.authority||candidate.frame.clock.unit!==data.frame.clock.unit)throw new TypeError('mismatched clock authority/unit');
  if(candidate.frame.clock.tick<data.frame.clock.tick||candidate.frame.clock.value<data.frame.clock.value||(candidate.frame.clock.tick===data.frame.clock.tick&&canonical(candidate.frame.clock)!==canonical(data.frame.clock)))throw new TypeError('stale/mismatched clock');
  data=candidate;paint(view);return api.stats();
 },setView(view){if(!disposed&&!lost)paint(view);},setEnabled(value){if(disposed||lost)return false;enabled=Boolean(value);if(enabled)paint();else release();return enabled;},
 resolve(instanceId){return Number.isInteger(instanceId)?visibleRows[instanceId]??null:null;},
 pick(raycaster){if(disposed||lost||!enabled||!meshes.length)return null;return api.resolve(raycaster.intersectObject(meshes[0],false)[0]?.instanceId);},
 stats(){const arrays=meshes.flatMap(m=>[m.instanceMatrix.array,m.instanceColor.array]);const geometryArrays=geometries.flatMap(g=>[...Object.values(g.attributes).map(a=>a.array),...(g.index?[g.index.array]:[])]);return {state:disposed?'disposed':lost?'device-lost':enabled?'ready':'disabled',count:visibleRows.length,capacity,drawCalls:meshes.length&&visibleRows.length?2:0,allocatedBufferBytes:[...arrays,...geometryArrays].reduce((n,a)=>n+a.byteLength,0),instanceBufferBytes:arrays.reduce((n,a)=>n+a.byteLength,0),missing:data.missing,zero:data.zero,omitted:data.omitted};},
 get data(){return data;},dispose(){if(disposed)return;disposed=true;release();device=null;}};
 return api;
}
