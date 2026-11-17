import {city,scaleValue,startSession} from './model.js';
/** @returns {any} Fixed IDs refer to buttons, range inputs and display elements. */
const $=id=>document.getElementById(id);
$('provenance').textContent=`${city.source} · ${city.version} · ${city.coordinates}`;
$('map').innerHTML=city.buildings.map(b=>`<rect x="${b.x-b.width/2}" y="${b.z-b.depth/2}" width="${b.width}" height="${b.depth}" fill="#ffc77b"/><text x="${b.x}" y="${b.z}" text-anchor="middle" font-size="4">${b.id}</text>`).join('');
let session,renderer,group,ring,hitSource,space,placed=false,starting=false;
function message(text){$('status').textContent=text;}
function scale(){const s=scaleValue($('scale').value);group?.scale.setScalar(s);$('size').textContent=`${(100*s).toFixed(2)} m city width`;}
$('scale').oninput=scale;
function cleanup(){hitSource?.cancel();hitSource=null;renderer?.setAnimationLoop(null);renderer?.domElement.remove();renderer?.dispose();group?.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});ring?.geometry.dispose();ring?.material.dispose();renderer=null;session=null;group=null;ring=null;placed=false;document.body.classList.remove('xr');for(const id of ['place','reset','stop'])$(id).disabled=true;$('start').disabled=false;message('AR ended. 2D view ready.');}
function place(){if(!ring?.visible||placed)return;group.position.copy(ring.position);group.quaternion.copy(ring.quaternion);group.visible=true;placed=true;ring.visible=false;$('place').disabled=true;$('reset').disabled=false;message('City placed. Walk slowly around it; scale or reposition with controls.');}
$('place').onclick=place;
$('reset').onclick=()=>{placed=false;group.visible=false;$('reset').disabled=true;message('Find a horizontal surface again.');};
$('stop').onclick=()=>session?.end();
document.addEventListener('keydown',e=>{if(e.key==='Escape')session?.end();});
$('start').onclick=async()=>{
 if(starting||session)return;starting=true;$('start').disabled=true;
 let active;
 try{
  // Request directly in the explicit user gesture, before loading the renderer.
  active=await startSession(/** @type {Navigator & {xr?: any}} */ (navigator).xr);session=active;active.addEventListener('end',cleanup,{once:true});
  // @ts-ignore Browser URL resolved by the existing vendor route.
  const THREE=await import('/vendor/three/three.module.js');
  if(session!==active)return;
  renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.xr.enabled=true;document.body.append(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();scene.add(new THREE.HemisphereLight(0xffffff,0x888888,3));
  group=new THREE.Group();group.visible=false;scene.add(group);
  // One schematic city metre maps to scale metres in the physical room.
  const base=new THREE.Mesh(new THREE.BoxGeometry(100,1,100),new THREE.MeshStandardMaterial({color:0x49775d}));base.position.y=-0.5;group.add(base);
  for(const b of city.buildings){const mesh=new THREE.Mesh(new THREE.BoxGeometry(b.width,b.height,b.depth),new THREE.MeshStandardMaterial({color:0xffc77b}));mesh.position.set(b.x,b.height/2,b.z);group.add(mesh);}
  ring=new THREE.Mesh(new THREE.RingGeometry(0.07,0.09,32).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0x55ffbb,side:THREE.DoubleSide}));ring.visible=false;scene.add(ring);scale();
  renderer.xr.setReferenceSpaceType('local');await renderer.xr.setSession(active);
  space=await active.requestReferenceSpace('local');const viewer=await active.requestReferenceSpace('viewer');
  if(session!==active)return;
  const source=await active.requestHitTestSource({space:viewer});if(session!==active){source.cancel();return;}hitSource=source;
  active.addEventListener('select',place);document.body.classList.add('xr');$('stop').disabled=false;message('Scan a horizontal table until the ring appears.');
  renderer.setAnimationLoop((time,frame)=>{if(frame&&!placed){const pose=frame.getHitTestResults(hitSource)[0]?.getPose(space);ring.visible=false;if(pose){const m=pose.transform.matrix; // Reject wall hits: local +Y must point upward.
   if(m[5]>0.9){ring.position.set(m[12],m[13],m[14]);ring.quaternion.setFromRotationMatrix(new THREE.Matrix4().fromArray(m));ring.visible=true;}}
   $('place').disabled=!ring.visible;}renderer.render(scene,camera);});
 }catch(error){if(active){await active.end().catch(()=>{});cleanup();}message(`AR unavailable or access denied: ${error.message}. 2D view remains available.`);$('start').disabled=false;}finally{starting=false;}
};
window.addEventListener('pagehide',()=>session?.end());
