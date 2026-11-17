import {mountDiscoveryFog} from './discovery-fog.js';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {cityViewOrigin,createStaticCity,gameViewURL} from './static-city-model.js';
const params=new URLSearchParams(location.search),$=id=>document.getElementById(id);
$('full-game').href=gameViewURL(location.href);document.documentElement.dataset.renderer='webgl2-city';
let discoveryFog=null;
let renderer,controls,observer,scene,camera,selected=null,city=null,disposed=false,failed=false,draws=0;
const resources=new Set(),meshes=[],materials=new Map();
const keep=value=>{resources.add(value);return value;};
function failure(error){failed=true;$('fit').disabled=true;$('inventory').disabled=true;$('failure').hidden=false;$('failure').replaceChildren();const p=document.createElement('p');p.textContent=error instanceof Error?error.message:'City view could not start.';const retry=document.createElement('button');retry.type='button';retry.textContent='Try again';retry.onclick=()=>location.reload();$('failure').append(p,retry);$('provenance').textContent='City geometry is unavailable. No simulation was started.';}
function render(){if(disposed||!renderer||!scene||!camera)return;renderer.render(scene,camera);draws++;}
function select(id){if(selected)selected.material=materials.get(selected.userData.building.kind)??materials.get('default');selected=meshes.find(m=>m.userData.building.id===String(id))??null;const out=$('details');out.replaceChildren();if(selected){selected.material=materials.get('selected');const b=selected.userData.building;for(const line of [b.name,`ID: ${b.id}`,`Geometry type: ${b.kind}`,`Footprint: ${Math.round(b.area)} m² · illustrative height: ${b.height.toFixed(1)} m`,`Map position: ${b.center.map(n=>n.toFixed(1)).join(', ')} metres`]){const p=document.createElement('p');p.textContent=line;out.append(p);}$('inventory').value=b.id;discoveryFog?.observe(b.id);}render();}
function fit(){if(!city)return;const b=city.bounds,x=(b.minX+b.maxX)/2,z=(b.minZ+b.maxZ)/2,height=city.buildings.reduce((max,b)=>Math.max(max,b.height),0),size=Math.max(120,b.maxX-b.minX,b.maxZ-b.minZ,height),radius=Math.hypot(b.maxX-b.minX,b.maxZ-b.minZ,height)/2,vertical=THREE.MathUtils.degToRad(camera.fov),horizontal=2*Math.atan(Math.tan(vertical/2)*camera.aspect),distance=Math.max(150,radius/Math.sin(Math.min(vertical,horizontal)/2)*1.12),target=new THREE.Vector3(x,height*.25,z);controls.target.copy(target);camera.position.copy(target).add(new THREE.Vector3(.65,.85,.8).normalize().multiplyScalar(distance));camera.near=.5;camera.far=Math.max(5000,distance*8);camera.updateProjectionMatrix();controls.maxDistance=Math.max(size*5,distance*3);controls.update();render();}
function resize(){if(!renderer||disposed)return;const host=$('view'),width=Math.max(1,host.clientWidth),height=Math.max(1,host.clientHeight);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();render();}
async function geometry(){
 let origin=cityViewOrigin(params),area={source:'none'},savedGeometry=false;
 if(params.has('experiment')){
  const id=params.get('experiment');$('saved-scope').hidden=false;$('saved-scope').textContent='Saved experiment: base geometry preview only. This is not a checkpoint replay; residents, edits, model time and outcomes are not restored.';
  if(!/^[A-Za-z0-9_-]{8,16}$/.test(id))throw Error('Invalid saved experiment. No replacement city was loaded.');
  const response=await fetch('/api/world-experiments/'+encodeURIComponent(id),{signal:AbortSignal.timeout(12000)}),record=await response.json();
  if(!response.ok||record?.schemaVersion!=='world-experiment-record.v1'||record.save?.schemaVersion!=='world-experiment-save.v1'||!record.save.geometry?.area)throw Error('Saved base geometry could not load. No replacement city was loaded.');
  const source=record.save.view?.origin;if(!Number.isFinite(source?.lat)||!Number.isFinite(source?.lng))throw Error('Saved map origin is missing. No replacement city was loaded.');origin={...source};area=record.save.geometry.area;savedGeometry=true;
 }else if(params.get('demo')!=='1'&&params.get('synthetic')!=='1'){
  try{const response=await fetch('/api/area?'+new URLSearchParams({...origin,radiusM:400,core:1}),{signal:AbortSignal.timeout(12000)});if(response.ok)area=await response.json();}catch{/* Source disclosure below labels procedural geometry explicitly. */}
 }
 return createStaticCity(origin,area,{savedGeometry});
}
async function start(){
 const canvas=document.createElement('canvas');canvas.tabIndex=0;canvas.setAttribute('aria-label','WebGL2 city geometry. Drag to orbit; right-drag to pan; scroll to zoom.');$('view').append(canvas);
 const gl=canvas.getContext('webgl2',{antialias:true,alpha:false});if(!gl)throw Error('WebGL2 is unavailable. Enable hardware acceleration and try again.');
 renderer=new THREE.WebGLRenderer({canvas,context:gl,antialias:true});renderer.setPixelRatio(Math.min(1.5,devicePixelRatio||1));renderer.setClearColor('#667c8f');renderer.outputColorSpace=THREE.SRGBColorSpace;
 scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(45,1,.5,5000);scene.add(new THREE.HemisphereLight('#fff4dc','#52614b',2.6));const sun=new THREE.DirectionalLight('#fff5e6',2.2);sun.position.set(-300,600,200);scene.add(sun);
 controls=new OrbitControls(camera,canvas);controls.enableDamping=false;controls.maxPolarAngle=Math.PI*.49;controls.minDistance=15;controls.addEventListener('change',render);
 city=await geometry();if(disposed)return;
 const colors={home:'#bbad92',work:'#8199af',food:'#c88f70',shop:'#b59c64',school:'#a296bb',park:'#618858',default:'#adb2af',selected:'#ffe3a0'};
 for(const[kind,color]of Object.entries(colors))materials.set(kind,keep(new THREE.MeshStandardMaterial({color,roughness:.95,metalness:0})));
 const b=city.bounds,ground=new THREE.Mesh(keep(new THREE.PlaneGeometry(b.maxX-b.minX+100,b.maxZ-b.minZ+100)),keep(new THREE.MeshStandardMaterial({color:'#69765b',roughness:1})));ground.rotation.x=-Math.PI/2;ground.position.set((b.minX+b.maxX)/2,-.1,(b.minZ+b.maxZ)/2);scene.add(ground);
 for(let i=0;i<city.buildings.length;i++){
  if(disposed)return;const building=city.buildings[i],shape=new THREE.Shape();building.poly.forEach(([x,z],index)=>index?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();
  const geometry=keep(new THREE.ExtrudeGeometry(shape,{depth:building.height,bevelEnabled:false,steps:1}));geometry.rotateX(-Math.PI/2);const mesh=new THREE.Mesh(geometry,materials.get(building.kind)??materials.get('default'));mesh.userData.building=building;scene.add(mesh);meshes.push(mesh);
  const option=document.createElement('option');option.value=building.id;option.textContent=building.name+' · '+building.kind;$('inventory').append(option);if(i%80===79)await new Promise(resolve=>setTimeout(resolve,0));
 }
 const roadMaterial=keep(new THREE.MeshStandardMaterial({color:'#424b55',roughness:1}));for(const road of city.roads)for(let i=1;i<road.pts.length;i++){const[a,z]=road.pts[i-1],[x,bz]=road.pts[i],length=Math.hypot(x-a,bz-z);if(!length)continue;const mesh=new THREE.Mesh(keep(new THREE.PlaneGeometry(length,8)),roadMaterial);mesh.rotation.set(-Math.PI/2,0,-Math.atan2(bz-z,x-a));mesh.position.set((a+x)/2,.035,(z+bz)/2);scene.add(mesh);}
 $('provenance').textContent=`${city.buildings.length} buildings · ${city.roads.length} roads · ${city.origin.lat.toFixed(4)}, ${city.origin.lng.toFixed(4)} · ${city.source==='osm'?'OpenStreetMap footprints; uses and heights may be illustrative':city.source==='synthetic'?'Saved synthetic geometry':'Procedural fictional geometry; no real-map coverage available'}. Rendered on demand.`;
 $('attribution').textContent=city.source==='osm'?'© OpenStreetMap contributors':'Procedural/synthetic map geometry';if(city.source!=='osm')$('attribution').removeAttribute('href');
 observer=new ResizeObserver(resize);observer.observe($('view'));resize();fit();
 let down=null;canvas.addEventListener('pointerdown',event=>{if(event.button===0)down={x:event.clientX,y:event.clientY,id:event.pointerId};});canvas.addEventListener('pointerup',event=>{const start=down;down=null;if(!start||start.id!==event.pointerId||Math.hypot(start.x-event.clientX,start.y-event.clientY)>5)return;const rect=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),camera);const hit=ray.intersectObjects(meshes)[0];if(hit)select(hit.object.userData.building.id);});
 canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();failure(Error('The graphics connection was lost. Reload to render the city again.'));});
 discoveryFog=mountDiscoveryFog({container:$('look'),buildings:city.buildings,source:city.source,onInspect:id=>{
  if(failed||disposed||!city.buildings.some(b=>String(b.id)===id))return false;
  select(id);return true;
 }});window.hblDiscoveryFog=discoveryFog;
 $('fit').disabled=false;$('inventory').disabled=false;
 $('inventory').addEventListener('change',()=>select($('inventory').value));$('fit').addEventListener('click',fit);
 window.hblStaticCity={getState:()=>({backend:'webgl2',viewOnly:true,ready:!failed,buildings:city.buildings.length,roads:city.roads.length,people:0,workers:0,simulation:false,draws,selectedId:selected?.userData.building.id??null,source:city.source,origin:{...city.origin},glVersion:gl.getParameter(gl.VERSION)})};
}
window.addEventListener('pagehide',()=>{disposed=true;discoveryFog?.dispose();observer?.disconnect();controls?.dispose();for(const resource of resources)resource.dispose();resources.clear();renderer?.dispose();},{once:true});
start().catch(failure);
