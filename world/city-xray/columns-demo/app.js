import * as THREE from 'three/webgpu';
import { planCameraPreset } from '../../camera-presets.js';
import { roadFrame } from './frame.js';
import { frameHash } from '../contract.js';
import { mountColumns } from '../columns.js';
const frame=roadFrame(0),metricId=frame.metrics[0].id,view=document.querySelector('#view'),status=document.querySelector('#status'),select=document.querySelector('#sample');
let renderer,layer,scene,camera,disposed=false,enabled=true,observer;
const errors=[];
const inspect=(roadId,shaft=null)=>{const s=frame.samples.find(s=>s.targetId===roadId);select.value=roadId;document.querySelector('#evidence').textContent=`${roadId}\nSample: ${JSON.stringify([metricId,roadId])}${shaft?`\nShaft: ${shaft.ordinal} · fraction ${shaft.fraction}`:''}\n${s.value===null?'Missing':s.value+' synthetic-symbols'} · represented residents unavailable\nRun: ${s.runId}\nMetric: ${metricId}\nClock: ${frame.clock.checkpoint} · minute 60 · tick 4`;};
for(const s of frame.samples){const option=document.createElement('option');option.value=s.targetId;option.textContent=`${s.targetId} · ${s.value??'missing'}`;select.append(option);const tr=document.createElement('tr');for(const v of [s.targetId,s.value??'Missing',s.units]){const td=document.createElement('td');td.textContent=v;tr.append(td);}document.querySelector('#rows').append(tr);}
select.onchange=()=>inspect(select.value);inspect(frame.samples[0].targetId);
const hash=await frameHash(frame);
document.querySelector('#identity').textContent=`Seed 0 · ${frame.schemaVersion} · model authored-road-intensity v1 · source city-grid-road-demo v1 · generator city-grid-fixture v1 + road-field v1 · ${frame.clock.checkpoint} · SHA-256 ${hash}`;
window.columnsDiagnostic={frame,hash,ready:false,errors,get layer(){return layer;},get renderer(){return renderer;},get camera(){return camera;},get scene(){return scene;},render:()=>draw(),dispose};
function draw(){if(disposed||!renderer||!layer)return;layer.setView({camera,stride:Number(document.querySelector('#quality').value)});renderer.render(scene,camera);status.textContent=`${renderer.backend.isWebGPUBackend?'Native WebGPU':'Fallback backend'} · ${layer.stats().count} display shafts · ${layer.stats().drawCalls} column draws · ${layer.stats().allocatedBufferBytes} allocated attribute bytes. GPU timing: use performance harness.`;}
function reset(){const pose=planCameraPreset('skyline',{x:0,y:0,z:0},[],.65);camera.position.set(pose.position.x*5,pose.position.y*5,pose.position.z*5);camera.lookAt(0,0,0);camera.updateMatrixWorld();}
function dispose(){if(disposed)return;disposed=true;observer?.disconnect();layer?.dispose();scene?.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();});renderer?.dispose();renderer?.domElement.remove();}
try{
 if(new URLSearchParams(location.search).has('noGPU')||!navigator.gpu)throw new Error('GPU unavailable');
 const adapter=await navigator.gpu.requestAdapter();if(!adapter)throw new Error('No adapter');
 window.columnsDiagnostic.adapter={...Object.fromEntries(['vendor','architecture','device','description','isFallbackAdapter'].map(k=>[k,adapter.info[k]])),features:[...adapter.features]};
 renderer=new THREE.WebGPURenderer({antialias:true,trackTimestamp:true});await renderer.init();
 if(!renderer.backend.isWebGPUBackend)throw new Error('Native WebGPU backend unavailable');
 const device=renderer.backend.device;device.addEventListener('uncapturederror',e=>errors.push(e.error.message));
 device.lost.then(()=>{if(disposed)return;dispose();status.textContent='Graphics device lost. Road evidence remains available. Reload to recover.';view.textContent='Graphics unavailable after device loss. Inspect the road evidence below.';document.querySelectorAll('nav button,nav select').forEach(b=>b.disabled=true);window.columnsDiagnostic.ready=false;window.columnsDiagnostic.unavailable=true;});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0x172630);
 scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x172630,.00055);
 camera=new THREE.PerspectiveCamera(48,1,1,6000);reset();
 // Same east/up/south coordinates and Three fog mechanism as the existing city renderer.
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(1700,1700),new THREE.MeshBasicNodeMaterial({color:0x24343b}));ground.rotation.x=-Math.PI/2;ground.position.y=-.5;scene.add(ground);
 const roadPositions=[];for(const r of frame.roads)for(let i=1;i<r.path.length;i++)roadPositions.push(...r.path[i-1],...r.path[i]);
 const rg=new THREE.BufferGeometry();rg.setAttribute('position',new THREE.Float32BufferAttribute(roadPositions,3));scene.add(new THREE.LineSegments(rg,new THREE.LineBasicNodeMaterial({color:0x50616a})));
 // Authored context blocks, not observed buildings; one instanced mesh.
 const bg=new THREE.BoxGeometry(1,1,1),bm=new THREE.MeshBasicNodeMaterial({color:0x3c4c54});const blocks=new THREE.InstancedMesh(bg,bm,16*16*4),matrix=new THREE.Matrix4();let b=0;
 for(let z=0;z<16;z++)for(let x=0;x<16;x++)for(let j=0;j<4;j++){const h=9+((x*17+z*7+j*11)%24);matrix.makeScale(21,h,24);matrix.setPosition((x-8)*80+22+(j%2)*33,h/2,(z-8)*80+22+Math.floor(j/2)*33);blocks.setMatrixAt(b++,matrix);}scene.add(blocks);
 layer=mountColumns({scene,renderer,frame,metricId});if(!await layer.ready)throw new Error('Layer initialization failed');
 view.replaceChildren(renderer.domElement);renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','Fixed aerial view of synthetic thin road columns; road evidence selector below');
 const resize=()=>{if(disposed)return;renderer.setSize(view.clientWidth,view.clientHeight);camera.aspect=view.clientWidth/view.clientHeight;camera.updateProjectionMatrix();draw();};observer=new ResizeObserver(resize);observer.observe(view);resize();
 renderer.domElement.addEventListener('pointerup',event=>{const rect=renderer.domElement.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),camera);const row=layer.pick(ray);if(row)inspect(row.roadId,row);});
 document.querySelector('#toggle').onclick=()=>{enabled=!enabled;layer.setEnabled(enabled);document.querySelector('#toggle').textContent=enabled?'Hide columns':'Show columns';document.querySelector('#toggle').setAttribute('aria-pressed',String(enabled));draw();};
 document.querySelector('#reset').onclick=()=>{reset();draw();};document.querySelector('#quality').onchange=draw;
 await renderer.renderAsync(scene,camera);window.columnsDiagnostic.ready=true;
}catch(error){dispose();view.textContent='Graphics unavailable. Inspect every authored road sample using the selector and evidence table below.';status.textContent=`Graphics unavailable: ${error.message}. GPU measurements NOT RUN.`;document.querySelectorAll('nav button,nav select').forEach(b=>b.disabled=true);window.columnsDiagnostic.unavailable=true;}
addEventListener('pagehide',dispose,{once:true});
