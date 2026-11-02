import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createCityRenderer} from '../render/renderer/webgpu-renderer.js';
import {generateBuildingGeometry} from '../render/geometry/building-generator.js';
import {createPhysicalPolicyLayer} from '../render/physical-policy-layer.js';
import {toBufferGeometry} from '../render/geometry/geometry-cache.js';
const finite=Number.isFinite;
const hash=id=>{let n=2166136261;for(const c of String(id))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
function geography(state){
 const origin=state.provenance?.origin||{},geo=state.buildings.find(b=>b.geometry?.coordinates?.[0]?.length)?.geometry.coordinates[0];
 const lat=finite(origin.lat)?origin.lat:geo?geo.reduce((s,p)=>s+p[1],0)/geo.length:0,lng=finite(origin.lng)?origin.lng:geo?geo.reduce((s,p)=>s+p[0],0)/geo.length:0;
 return p=>[(p[0]-lng)*111320*Math.cos(lat*Math.PI/180),-(p[1]-lat)*110540];
}
export function constitutionCityLayout(state){
 if(!state||!Array.isArray(state.buildings))throw Error('CityState buildings are required.');
 const project=geography(state),districts=new Map((state.districts||[]).map((d,i)=>[d.id,{x:finite(d.x)?d.x:(i-(state.districts.length-1)/2)*140,z:finite(d.z)?d.z:(i%2)*80}]));
 const parcels=new Map((state.parcels||[]).map(p=>[p.id,p]));
 const buildings=state.buildings.map(b=>{const parcel=parcels.get(b.parcelId),ring=b.geometry?.coordinates?.[0]||parcel?.geometry?.coordinates?.[0];let poly;
  if(ring?.length>=3){poly=ring.map(project);if(poly.length>3&&poly[0][0]===poly.at(-1)[0]&&poly[0][1]===poly.at(-1)[1])poly.pop();}
  const anchor=districts.get(b.districtId)||{x:0,z:0},seed=hash(b.id),x=anchor.x+(seed%7-3)*16,z=anchor.z+(Math.floor(seed/7)%7-3)*16;
  if(!poly)poly=[[x-6,z-6],[x+6,z-6],[x+6,z+6],[x-6,z+6]];
  const center=poly.reduce((s,p)=>[s[0]+p[0]/poly.length,s[1]+p[1]/poly.length],[0,0]);
  return{id:b.id,districtId:b.districtId,sourceId:b.sourceId||null,poly,center,height:Math.max(3,Math.min(160,(b.floors||1)*3.2)),syntheticLocation:!ring,record:b};
 });
 // Put schematic district links next to actual imported geometry, not in a different coordinate frame.
 for(const[id,anchor]of districts){const local=buildings.filter(b=>b.districtId===id);if(local.length){anchor.x=local.reduce((s,b)=>s+b.center[0],0)/local.length;anchor.z=local.reduce((s,b)=>s+b.center[1],0)/local.length;}}
 return{buildings,districts};
}
/** Stable-ID geographic joins only. Parcel outlines are footprint proxies;
 * synthetic district links never become real surveyed routes. */
export function constitutionGeographicDiff(state,diff){
 const changed=key=>(diff?.changes?.[key]||[]).filter(row=>row.status!=='unchanged');
 const buildingIds=new Set(changed('buildings').map(row=>row.id));
 const parcelIds=new Set(changed('parcels').map(row=>row.id));
 for(const building of state.buildings||[])if(parcelIds.has(building.parcelId))buildingIds.add(building.id);
 for(const row of changed('units')){const unit=(state.units||[]).find(unit=>unit.id===row.id);if(unit)buildingIds.add(unit.buildingId);}
 return{buildingIds:[...buildingIds],parcelIds:[...parcelIds],linkIds:changed('links').map(row=>row.id),removedBuildingIds:changed('buildings').filter(row=>row.status==='removed').map(row=>row.id),geometrySource:state.provenance?.geometrySource||'synthetic',limitations:['Mapped footprints locate buildings only; parcels are footprint proxies, not surveyed land boundaries.','District transport connections are schematic. No real road or individual beneficiary is inferred.','Highlights show paired state differences, not proof of exclusive clause causation.']};
}
export function mountConstitutionCityView(container,{onCameraChange,onSelect}={}){
 if(!container?.ownerDocument)throw Error('City view needs a container.');
 const doc=container.ownerDocument,win=doc.defaultView,scene=new THREE.Scene();scene.background=new THREE.Color('#dbe5db');
 const camera=new THREE.PerspectiveCamera(45,1,.1,10000);camera.position.set(240,240,300);
 const canvas=doc.createElement('canvas');canvas.tabIndex=0;canvas.setAttribute('aria-label','Interactive simulated city. Drag to orbit; scroll to zoom.');container.append(canvas);
 const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.12;
 const lighting=new THREE.HemisphereLight(0xffffff,0x607254,2);scene.add(lighting);const sun=new THREE.DirectionalLight(0xfff2d6,2.5);sun.position.set(200,500,100);scene.add(sun);
 const content=new THREE.Group();scene.add(content);const physicalPolicy=createPhysicalPolicyLayer({THREE,scene,town:{roads:[]}});const legend=doc.createElement('p');legend.style.cssText='position:absolute;left:8px;bottom:6px;right:8px;margin:0;padding:5px 7px;background:#f3f7ecdd;font:10px/1.4 system-ui;color:#254536;pointer-events:none';container.append(legend);
 const inspect=doc.createElement('p');inspect.style.cssText='position:absolute;left:8px;top:6px;right:8px;margin:0;padding:5px 7px;background:#f3f7ecee;font:11px/1.4 system-ui;color:#254536';inspect.hidden=true;inspect.setAttribute('role','status');container.append(inspect);
 let overlayEnabled=true,potentialEnabled=false;
 const overlayLabel=doc.createElement('label');overlayLabel.style.cssText='position:absolute;right:8px;top:8px;padding:5px;background:#f3f7ecee;font:11px system-ui;color:#254536;z-index:2';const overlayInput=doc.createElement('input');overlayInput.type='checkbox';overlayInput.checked=true;overlayInput.setAttribute('aria-label','Show recorded world differences');overlayLabel.append(overlayInput,doc.createTextNode('Recorded world diff'));container.append(overlayLabel);
 const overlayChange=()=>{overlayEnabled=overlayInput.checked;draw();};overlayInput.addEventListener('change',overlayChange);
 let renderer=null,destroyed=false,frameId=null,payload=null,first=true,syncing=false,backend=null,visible=true,pickables=[],down=null,lastPose='';
 const resize=()=>{if(!renderer||destroyed)return;const width=Math.max(1,container.clientWidth),height=Math.max(1,container.clientHeight);camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height,false);canvas.style.width='100%';canvas.style.height='100%';};
 const observer=new win.ResizeObserver(resize);observer.observe(container);
 const visibility=win.IntersectionObserver?new win.IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting!==false;}):null;visibility?.observe(container);
 function clear(){content.traverse(n=>{n.geometry?.dispose();for(const m of Array.isArray(n.material)?n.material:n.material?[n.material]:[])m.dispose();});content.clear();pickables=[];}
 function line(a,b,color){const mesh=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a),new THREE.Vector3(...b)]),new THREE.LineBasicMaterial({color,transparent:true,opacity:.65}));content.add(mesh);return mesh;}
 function draw(){
  if(!payload?.state||destroyed)return;clear();const state=payload.state,layout=constitutionCityLayout(state),byBuilding=new Map(layout.buildings.map(b=>[b.id,b]));
  physicalPolicy.update({minute:(state.month??0)*30*1440,projects:state.projects??[],districts:[...layout.districts].map(([id,row])=>({id,...row})),source:'Actual selected city project stages; district anchors are schematic',transitService:0});
  const winners=new Set((payload.diff?.distribution?.winners||[]).map(h=>h.id)),losers=new Set((payload.diff?.distribution?.losers||[]).map(h=>h.id));
  const geographicDiff=constitutionGeographicDiff(state,payload.diff),changed=new Set(overlayEnabled?geographicDiff.buildingIds:[]),changedLinks=new Set(overlayEnabled?geographicDiff.linkIds:[]);
  let mapped=0;
  for(const b of layout.buildings){let geometry;try{geometry=toBufferGeometry(generateBuildingGeometry({id:b.id,poly:b.poly,height:b.height,kind:'home'},'LOW'));}catch{continue;}
   const mesh=new THREE.Mesh(geometry,new THREE.MeshLambertMaterial({color:payload.mode!=='before'&&changed.has(b.id)?0x45a278:b.syntheticLocation?0x8d9275:0x526e64,transparent:true,opacity:state.provenance?.confidence==='low'?.88:1}));mesh.userData={kind:'building',id:b.id,record:b.record};content.add(mesh);pickables.push(mesh);if(!b.syntheticLocation)mapped++;
  }
  if(overlayEnabled&&payload.mode!=='before'&&payload.baselineState&&geographicDiff.removedBuildingIds.length){const removed=new Set(geographicDiff.removedBuildingIds);for(const b of constitutionCityLayout(payload.baselineState).buildings)if(removed.has(b.id)){const ghost=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(b.poly.map(([x,z])=>new THREE.Vector3(x,b.height+.3,z))),new THREE.LineBasicMaterial({color:0xc45d52,depthTest:false}));ghost.renderOrder=12;ghost.userData={kind:'removed building',id:b.id,record:b.record};content.add(ghost);pickables.push(ghost);}}
  const points=layout.buildings.flatMap(b=>b.poly),xs=points.map(p=>p[0]),zs=points.map(p=>p[1]),minX=Math.min(-150,...xs)-40,maxX=Math.max(150,...xs)+40,minZ=Math.min(-150,...zs)-40,maxZ=Math.max(150,...zs)+40;
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(maxX-minX,maxZ-minZ),new THREE.MeshLambertMaterial({color:0xc3cba6}));ground.rotation.x=-Math.PI/2;ground.position.set((minX+maxX)/2,-.12,(minZ+maxZ)/2);content.add(ground);
  for(const link of state.links||[]){const a=layout.districts.get(link.from),b=layout.districts.get(link.to);if(a&&b){const color=new THREE.Color(link.mode==='transit'?0x5b8ca4:0x71836e).lerp(new THREE.Color(0xbd715d),Math.max(0,Math.min(1,(link.flow||0)/Math.max(1,link.capacity)-1)));const route=line([a.x,.5,a.z],[b.x,.5,b.z],payload.mode!=='before'&&changedLinks.has(link.id)?0xe5813e:color);route.userData={kind:'link',id:link.id,record:link};pickables.push(route);}}
  for(const h of(state.households||[]).slice(0,2000)){const unit=state.units.find(u=>u.id===h.unitId),building=byBuilding.get(unit?.buildingId),anchor=building?{x:building.center[0],z:building.center[1]}:layout.districts.get(h.districtId);if(!anchor)continue;const offset=hash(h.id),marker=new THREE.Mesh(new THREE.SphereGeometry(1.5,6,4),new THREE.MeshLambertMaterial({color:payload.selection?.kind==='households'&&payload.selection.id===h.id?0xffe35b:payload.mode!=='before'&&winners.has(h.id)?0x48aa7c:payload.mode!=='before'&&losers.has(h.id)?0xc8825c:0xe8bc5d}));marker.position.set(anchor.x+(offset%5-2)*2,(building?.height||0)+2,anchor.z+(Math.floor(offset/5)%5-2)*2);if(payload.selection?.kind==='households'&&payload.selection.id===h.id)marker.scale.setScalar(1.8);marker.userData={kind:'household',id:h.id,record:h};content.add(marker);pickables.push(marker);}
  for(const b of state.businesses||[]){const anchor=layout.districts.get(b.districtId);if(!anchor)continue;const offset=hash(b.id),marker=new THREE.Mesh(new THREE.ConeGeometry(2.5,5,4),new THREE.MeshLambertMaterial({color:b.status==='open'?0x639cbb:0xc18b76}));marker.position.set(anchor.x+(offset%5-2)*7,3,anchor.z+(Math.floor(offset/5)%5-2)*7);if(payload.selection?.kind==='businesses'&&payload.selection.id===b.id)marker.scale.setScalar(1.8);marker.userData={kind:'business',id:b.id,record:b};content.add(marker);pickables.push(marker);}
  for(const project of state.projects||[]){
   if(project.stage==='abandoned')continue;const anchor=layout.districts.get(project.districtId);if(!anchor)continue;
   const phase=project.stage==='completion'?1:Math.max(0,Math.min(1,(project.progress||0)/Math.max(1,project.duration))),height=Math.max(.5,phase*12),offset=hash(project.id);
   const glyph=new THREE.Mesh(new THREE.BoxGeometry(5,height,5),new THREE.MeshLambertMaterial({color:project.type==='transit'?0x3f87ad:project.type==='resilience'?0x4c9a9c:0xbead68,transparent:phase<1,opacity:phase<1?.55:1,wireframe:phase===0}));
   glyph.position.set(anchor.x+(offset%7-3)*9,height/2,anchor.z+(Math.floor(offset/7)%7-3)*9);glyph.userData={kind:'project',id:project.id,record:project};content.add(glyph);pickables.push(glyph);
  }
  const type=payload.clause?.mapping?.type,scope=payload.clause?.supported===true;
  if(scope&&potentialEnabled)for(const b of layout.buildings){if(type==='transit')continue;const ring=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(b.poly.map(([x,z])=>new THREE.Vector3(x,b.height+.25,z))),new THREE.LineBasicMaterial({color:0xe0ad4f,depthTest:false}));ring.renderOrder=10;content.add(ring);}
  legend.textContent=`Month ${payload.month??state.month??0} · ${mapped} mapped footprints · ${state.households.length} synthetic households. Gold: household glyphs; green: recorded building/unit/parcel changes; orange: changed schematic district links; red outlines: removed buildings. ${geographicDiff.parcelIds.length} changed parcel proxies. Lines are not surveyed routes. Green/orange households: recorded financial signals, not welfare. Businesses/projects and drain crews: schematic district glyphs tied to actual project stage/progress.`;
  if(first){first=false;controls.target.set((minX+maxX)/2,0,(minZ+maxZ)/2);const span=Math.max(maxX-minX,maxZ-minZ);camera.position.set(controls.target.x+span*.45,span*.6,controls.target.z+span*.65);controls.update();}
 }
 const pose=()=>({position:camera.position.toArray(),target:controls.target.toArray()});
 const change=()=>{if(syncing||destroyed)return;const value=pose(),key=JSON.stringify(value);if(key===lastPose)return;lastPose=key;onCameraChange?.(value);};controls.addEventListener('change',change);
 const pointerDown=e=>{down=[e.clientX,e.clientY];},pointerUp=e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>6)return;const rect=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);const hit=ray.intersectObjects(pickables)[0];if(!hit){inspect.hidden=true;return;}const {kind,id,record}=hit.object.userData;inspect.textContent=`${kind} ${id}${record.status?' · '+record.status:''}${record.stage?' · '+record.stage:''}${finite(record.travelTime)?' · travel '+record.travelTime.toFixed(1)+' modeled min':''}${finite(record.capacity)?' · capacity '+record.capacity:''}${finite(record.progress)?' · progress '+record.progress.toFixed(1)+' / '+record.duration:''}${finite(record.income)?' · modeled monthly income '+record.income.toFixed(0):''}${finite(record.savings)?' · savings '+record.savings.toFixed(0):''}. Synthetic record; inspect the paired analysis below for changes and recorded reasons.`;inspect.hidden=false;onSelect?.({kind,id,record});container.dispatchEvent(new win.CustomEvent('constitution-city-select',{bubbles:true,detail:{kind,id}}));};
 canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointerup',pointerUp);
 const api={update(next){payload=next;draw();},setCamera(value){if(!value||![value.position,value.target].every(a=>Array.isArray(a)&&a.length===3&&a.every(v=>finite(v)&&Math.abs(v)<1000000)))return;syncing=true;camera.position.fromArray(value.position);controls.target.fromArray(value.target);controls.update();lastPose=JSON.stringify(pose());syncing=false;},getCamera:pose,getStats(){return{backend,month:payload?.state?.month,seed:payload?.state?.seed,objects:content.children.length,source:payload?.state?.provenance,geographicDiff:payload?.state?constitutionGeographicDiff(payload.state,payload.diff):null,overlayEnabled,physicalPolicy:physicalPolicy.getStats()};},destroy(){if(destroyed)return;destroyed=true;if(frameId!==null)win.cancelAnimationFrame(frameId);observer.disconnect();visibility?.disconnect();physicalPolicy.destroy();overlayInput.removeEventListener('change',overlayChange);overlayLabel.remove();controls.removeEventListener('change',change);controls.dispose();canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointerup',pointerUp);clear();renderer?.dispose();canvas.remove();legend.remove();inspect.remove();},ready:null};
 api.ready=(async()=>{try{const result=await createCityRenderer({forceWebGL:new URLSearchParams(win.location.search).get('renderer')==='webgl',canvas,antialias:true});if(destroyed){result.renderer.dispose();return;}renderer=result.renderer;backend=result.mode;resize();const frame=()=>{if(destroyed)return;frameId=win.requestAnimationFrame(frame);if(!visible)return;controls.update();renderer.render(scene,camera);};frame();}catch(error){inspect.hidden=false;inspect.textContent=`3D renderer unavailable: ${error.message}. Recorded analysis remains available.`;}return api;})();
 return api;
}
