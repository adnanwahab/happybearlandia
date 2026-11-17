import * as THREE from 'three';
import {streetStops,nearestStop,snapDirection} from './locomotion.js';

/**
 * @typedef {Object} WalkOptions
 * @property {any} renderer
 * @property {any} scene
 * @property {any} camera
 * @property {any} controls
 * @property {any} town
 * @property {()=>boolean} [eligible]
 * @property {()=>()=>void} [pause]
 * @property {any} [xr] Optional WebXR API (not in TypeScript DOM declarations).
 * @property {boolean} [secure]
 * @property {(state:any)=>void} [onChange]
 * @property {()=>string} [sourceLabel]
 */
/** Owns only presentation resources. No save, sharing, model or entity writes.
 * @param {WalkOptions} options
 */
export function createCityWalk({renderer,scene,camera,controls,town,eligible=()=>false,pause=()=>()=>{},xr=globalThis.navigator?.['xr'],secure=globalThis.isSecureContext,onChange=()=>{}}){
 const stops=streetStops(town),rig=new THREE.Group(),ray=new THREE.Raycaster();
 const owned=[],listeners=[],controllers=[],latches=new Map();
 let active=false,pending=false,disposed=false,session=null,restore=null,pose=null,error='',vignette=true,hud=null,buttons=[];
 const own=object=>{owned.push(object);return object;};
 const material=options=>own(new THREE.MeshBasicMaterial(options));
 const geometry=value=>own(value);
 const comfort=new THREE.Mesh(geometry(new THREE.RingGeometry(.075,.5,64)),material({color:0x000000,transparent:true,opacity:.85,depthTest:false,depthWrite:false}));
 comfort.position.z=-.15;comfort.renderOrder=10000;
 function state(){return{active,pending,immersive:!!session,error,stops:stops.length,vignette};}
 function notify(){onChange(state());}
 function allowed(){return !disposed&&eligible()&&stops.length>0;}
 function start(){
  if(active)return;if(!allowed())throw Error('Open a successfully restored saved scene with road geometry first.');
  const stop=nearestStop(stops,controls.target);pose={parent:camera.parent,position:camera.position.clone(),quaternion:camera.quaternion.clone(),target:controls.target.clone(),enabled:controls.enabled,near:camera.near,xrEnabled:renderer.xr.enabled,loop:renderer.getAnimationLoop()};
  restore=pause();controls.enabled=false;camera.near=.01;camera.updateProjectionMatrix();rig.position.set(stop.x,0,stop.z);rig.rotation.set(0,0,0);scene.add(rig);rig.add(camera);camera.position.set(0,1.65,0);camera.quaternion.identity();camera.add(comfort);active=true;error='';notify();
 }
 function cleanup(){
  if(!active)return;active=false;session=null;latches.clear();
  for(const remove of listeners.splice(0))remove();for(const controller of controllers.splice(0))controller.removeFromParent();
  hud?.removeFromParent();hud=null;buttons=[];while(owned.length>2)owned.pop().dispose();comfort.removeFromParent();camera.removeFromParent();rig.removeFromParent();
  if(pose.parent)pose.parent.add(camera);camera.position.copy(pose.position);camera.quaternion.copy(pose.quaternion);controls.target.copy(pose.target);controls.enabled=pose.enabled;camera.near=pose.near;camera.updateProjectionMatrix();renderer.xr.enabled=pose.xrEnabled;
  void renderer.setAnimationLoop(pose.loop);restore?.();restore=null;notify();
 }
 async function exit(){if(session){try{await session.end();}catch{error='Headset exit failed; use the headset system menu.';notify();return;}}cleanup();}
 function teleport(stop){if(!active||!stops.includes(stop))return false;const head=camera.getWorldPosition(new THREE.Vector3());rig.position.x+=stop.x-head.x;rig.position.z+=stop.z-head.z;notify();return true;}
 function turn(direction){if(!active||!Number.isFinite(direction)||direction===0)return;const before=camera.getWorldPosition(new THREE.Vector3());rig.rotation.y-=Math.sign(direction)*Math.PI/6;rig.updateMatrixWorld(true);const after=camera.getWorldPosition(new THREE.Vector3());rig.position.x+=before.x-after.x;rig.position.z+=before.z-after.z;}
 function comfortToggle(){vignette=!vignette;notify();}
 function addHUD(){
  hud=new THREE.Group();camera.add(hud);hud.position.set(0,-.23,-1.2);
  /** @type {Array<[string,()=>void]>} */
  const actions=[['Turn left',()=>turn(-1)],['Turn right',()=>turn(1)],['Comfort',comfortToggle],['Exit',()=>void exit()]];
  actions.forEach(([label,action],i)=>{
   const canvas=document.createElement('canvas');canvas.width=256;canvas.height=96;const ctx=canvas.getContext('2d');ctx.fillStyle='#15283e';ctx.fillRect(0,0,256,96);ctx.fillStyle='white';ctx.font='28px sans-serif';ctx.textAlign='center';ctx.fillText(label,128,57);
   const texture=own(new THREE.CanvasTexture(canvas)),mesh=new THREE.Mesh(geometry(new THREE.PlaneGeometry(.29,.11)),material({map:texture,depthTest:false}));mesh.position.x=(i-1.5)*.31;mesh.renderOrder=10001;mesh.userData.action=action;hud.add(mesh);buttons.push(mesh);
  });
 }
 function select(controller){if(!active)return;controller.updateWorldMatrix(true,false);ray.ray.origin.setFromMatrixPosition(controller.matrixWorld);ray.ray.direction.set(0,0,-1).transformDirection(controller.matrixWorld);
  const hit=ray.intersectObjects(buttons,false)[0];if(hit){hit.object.userData.action();return;}
  const p=ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),new THREE.Vector3());if(!p)return;
  const head=camera.getWorldPosition(new THREE.Vector3());if(head.distanceTo(p)>20)return;const stop=nearestStop(stops,p,4);if(stop)teleport(stop);
 }
 async function enterVR(){
  if(pending||active||disposed)return;pending=true;error='';notify();let acquired;
  try{
   if(!allowed())throw Error('Open a successfully restored saved scene with road geometry first.');
   if(!secure||!xr)throw Error('Immersive VR unavailable. Use Street view on this device.');
   // The native World renderer must not fall through to XRWebGLLayer on WebGPU.
   acquired=await xr.requestSession('immersive-vr',{requiredFeatures:['local-floor','webgpu']});
   if(disposed){await acquired.end();return;}
   start();session=acquired;renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType('local-floor');
   const ended=()=>queueMicrotask(cleanup);session.addEventListener('end',ended,{once:true});listeners.push(()=>acquired.removeEventListener('end',ended));
   camera.position.set(0,0,0);await renderer.setAnimationLoop(draw);await renderer.xr.setSession(session);
   if(disposed||!active){await acquired.end();return;}
   addHUD();for(let i=0;i<2;i++){
    const controller=renderer.xr.getController(i);rig.add(controller);controllers.push(controller);
    const pointer=new THREE.Line(geometry(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,0,-20)])),own(new THREE.LineBasicMaterial({color:0x8edcff})));controller.add(pointer);listeners.push(()=>pointer.removeFromParent());
    const handler=()=>select(controller);controller.addEventListener('select',handler);listeners.push(()=>controller.removeEventListener('select',handler));
   }
  }catch(e){if(acquired)try{await acquired.end();}catch{}cleanup();error=`VR unavailable or access declined: ${e.message}. Use Street view.`;}
  finally{pending=false;notify();}
 }
 function draw(){if(!active)return;comfort.visible=vignette;
  for(const input of session?.inputSources??[]){const axes=input.gamepad?.axes??[],next=snapDirection(axes.length>=4?axes[2]:axes[0],latches.get(input)??false);latches.set(input,next.latched);if(next.direction)turn(next.direction);}
  renderer.render(scene,camera);
 }
 return{state,stops,enterVR,enterDesktop(){try{start();}catch(e){error=e.message;notify();}},exit,teleport,turn,comfortToggle,draw,
  destroy(){disposed=true;if(session)void session.end().catch(()=>{});cleanup();for(const item of owned.splice(0))item.dispose();},get active(){return active;},get immersive(){return !!session;}};
}

/** @param {WalkOptions & {container:HTMLElement}} config */
export function mountCityWalk({container,...options}){
 const doc=container.ownerDocument,root=doc.createElement('details');root.className='city-walk';const title=doc.createElement('summary');title.textContent='VR City Walk';root.append(title);
 const help=doc.createElement('p');help.textContent='Saved run · flat schematic road viewpoints. Trigger: point at a road to teleport or select a headset button. Stick: 30° snap turn. No smooth movement. Comfort narrows the view. Street view works without a headset.';root.append(help);
 const status=doc.createElement('p');status.setAttribute('role','status');root.append(status);
 const style=doc.createElement('style');style.textContent='.city-walk{background:#14263a;color:white;padding:10px;max-width:340px}.city-walk button,.city-walk select,.city-walk summary{min-height:44px;min-width:44px}.city-walk button{margin:3px}.city-walk:focus-within{outline:2px solid #9edcff}';root.append(style);
 function button(text,action){const b=doc.createElement('button');b.type='button';b.textContent=text;b.onclick=action;root.append(b);return b;}
 const walk=createCityWalk({...options,onChange:update});
 const vr=button('Enter VR',()=>void walk.enterVR()),desktop=button('Street view',()=>walk.enterDesktop());
 const select=doc.createElement('select');select.setAttribute('aria-label','Street teleport destination');for(const stop of walk.stops){const option=doc.createElement('option');option.value=stop.id;option.textContent=`${stop.id} · ${Math.round(stop.x)}, ${Math.round(stop.z)} m`;select.append(option);}root.append(select);
 const go=button('Teleport',()=>walk.teleport(walk.stops.find(s=>s.id===select.value))),left=button('Turn left',()=>walk.turn(-1)),right=button('Turn right',()=>walk.turn(1)),comfort=button('Comfort vignette',()=>walk.comfortToggle()),exit=button('Exit walk',()=>void walk.exit());
 function update(){const s=walk.state();status.textContent=s.error||(!options.eligible()?'Open a successfully restored saved experiment to walk.':s.active?'Saved run paused at the current frame · camera movement is manual. '+(options.sourceLabel?.()??''):'Ready · checkpoint and source geometry stay unchanged.');vr.disabled=desktop.disabled=s.active||s.pending||!options.eligible()||!s.stops;for(const b of [go,left,right,comfort,exit])b.disabled=!s.active;select.disabled=!s.active;comfort.setAttribute('aria-pressed',String(s.vignette));}
 function key(e){if(!walk.active||!root.contains(e.target))return;if(e.key==='Escape'){e.preventDefault();e.stopPropagation();void walk.exit();}else if(e.target.tagName==='BUTTON'&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();e.stopPropagation();walk.turn(e.key==='ArrowLeft'?-1:1);}}
 function block(e){if(!walk.active)return;if(e.type==='keydown'&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();void walk.exit();return;}if(!root.contains(e.target)){e.preventDefault();e.stopImmediatePropagation();}}
 const blocked=['pointerdown','click','keydown','wheel'];for(const type of blocked)doc.addEventListener(type,block,{capture:true,passive:false});
 root.addEventListener('keydown',key,true);container.append(root);update();return{...walk,get active(){return walk.active;},get immersive(){return walk.immersive;},destroy(){for(const type of blocked)doc.removeEventListener(type,block,true);root.removeEventListener('keydown',key,true);walk.destroy();root.remove();}};
}
