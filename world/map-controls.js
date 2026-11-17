/** Local camera panning only: never navigates, reloads a tile or changes zoom.
 * mountMapControls({container,camera,controls,THREE,buttons=true,onPan?}) ->
 * {update(now|{now,enabled}),panScreen(direction),pan(direction,meters),
 * getScreenFootprint(),getPanFootprint(),setEnabled(),setSpeed(multiplier),destroy()}.
 * Call update(now) in the EXISTING frame loop. No RAF is created here.
 * For the shared minimap arrow pad use buttons:false, and pass panScreen to it.
 * North=-world Z, East=+world X; clicks move one local viewport scale at the
 * orbit target. Full far-frustum bounds are diagnostic only, never a pan step.
 * Emits a local bubbling `world:local-pan` event; consumers may stream geometry.
 */
const DIRECTIONS = Object.freeze({north:[0,-1],south:[0,1],east:[1,0],west:[-1,0]});
const KEYS = Object.freeze({ArrowUp:'north',ArrowDown:'south',ArrowLeft:'west',ArrowRight:'east'});
const finite = Number.isFinite;
const stylesheet = new URL('./map-controls.css',import.meta.url).href;

export function isMapPanTypingTarget(target) {
  return Boolean(target?.isContentEditable || target?.closest?.('input,textarea,select,form,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="combobox"],[role="dialog"],[data-map-pan-ignore]'));
}
/** Intersect all 12 near/far frustum edges with a horizontal ground plane. This
 * stays finite when top rays see sky: far clipping, not an arbitrary tile width,
 * bounds the ground footprint. Supports Perspective/Orthographic camera zoom.
 */
export function cameraGroundFootprint({camera,controls,THREE,groundY=0}={}) {
  if(!camera?.position||!THREE?.Vector3)throw new TypeError('A camera and THREE.Vector3 are required.');
  camera.updateMatrixWorld?.();
  const corners=[];
  for(const z of [-1,1])for(const y of [-1,1])for(const x of [-1,1])corners.push(new THREE.Vector3(x,y,z).unproject(camera));
  const points=[];
  const add = point => {if([point.x,point.z].every(finite))points.push({x:point.x,z:point.z});};
  for(let i=0;i<8;i++)for(const bit of [1,2,4]){
    const j=i^bit;if(j<=i)continue;
    const a=corners[i],b=corners[j],ay=a.y-groundY,by=b.y-groundY;
    if(Math.abs(ay)<1e-8)add(a);if(Math.abs(by)<1e-8)add(b);
    if(ay*by<0){const t=-ay/(by-ay);add({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});}
  }
  if(points.length>=3){
    const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x)),minZ=Math.min(...points.map(p=>p.z)),maxZ=Math.max(...points.map(p=>p.z));
    if(maxX-minX>1e-6&&maxZ-minZ>1e-6)return{minX,maxX,minZ,maxZ,width:maxX-minX,depth:maxZ-minZ,groundY,source:'clipped-camera-ground-frustum'};
  }
  // If no ground is in view, use the camera's current focus plane. This fallback
  // still follows projection/zoom/aspect; it does not invent a loaded tile size.
  const target=controls?.target||{x:0,y:groundY,z:0};
  const distance=Math.hypot(camera.position.x-target.x,camera.position.y-(target.y||0),camera.position.z-target.z)||1;
  const fov=(camera.getEffectiveFOV?.()??camera.fov??45)*Math.PI/180;
  const height=camera.isOrthographicCamera?Math.abs(camera.top-camera.bottom)/(camera.zoom||1):2*distance*Math.tan(fov/2);
  const width=camera.isOrthographicCamera?Math.abs(camera.right-camera.left)/(camera.zoom||1):height*(camera.aspect||1);
  return{minX:target.x-width/2,maxX:target.x+width/2,minZ:target.z-height/2,maxZ:target.z+height/2,width,depth:height,groundY,source:'camera-focus-plane-fallback'};
}
/** Local screen scale centered on the look-at point, independent of far clip.
 * Perspective FOV defines the viewport-sized rectangle at the orbit target's
 * depth; orthographic extent includes zoom. This deliberately excludes distant
 * horizon ground so one arrow cannot jump across several unloaded kilometers.
 */
export function cameraLocalPanFootprint({camera,controls,groundY=0}={}) {
  if(!camera?.position||!controls?.target)throw new TypeError('A camera and orbit target are required.');
  const target=controls.target;
  const distance=Math.hypot(camera.position.x-target.x,camera.position.y-(target.y??groundY),camera.position.z-target.z);
  const fov=(camera.getEffectiveFOV?.()??camera.fov??45)*Math.PI/180;
  const zoom=finite(camera.zoom)&&camera.zoom>0?camera.zoom:1;
  const height=camera.isOrthographicCamera?Math.abs(camera.top-camera.bottom)/zoom:2*Math.max(distance,.01)*Math.tan(fov/2);
  const width=camera.isOrthographicCamera?Math.abs(camera.right-camera.left)/zoom:height*(camera.aspect||1);
  return{minX:target.x-width/2,maxX:target.x+width/2,minZ:target.z-height/2,maxZ:target.z+height/2,width,depth:height,groundY,center:{x:target.x,z:target.z},source:'target-depth-local-viewport'};
}
export function translateMapView(camera,controls,dx,dz) {
  if(!camera?.position||!controls?.target||![dx,dz].every(finite))return false;
  camera.position.x+=dx;camera.position.z+=dz;controls.target.x+=dx;controls.target.z+=dz;
  controls.update?.();camera.updateMatrixWorld?.();
  return true;
}

export function mountMapControls({container,camera,controls,THREE,buttons=true,onPan,groundY=0,screensPerSecond=0.8}={}) {
  if(!container?.ownerDocument||!camera?.position||!controls?.target)throw new TypeError('Map controls require a container, camera and orbit target.');
  const doc=container.ownerDocument,win=doc.defaultView;
  const root=doc.createElement('section');root.className=`map-controls${buttons?'':' map-controls-keyboard-only'}`;root.setAttribute('aria-label','Pan current map without reloading');root.dataset.testid='map-pan-controls';
  const sheet=doc.createElement('link');sheet.rel='stylesheet';sheet.href=stylesheet;container.append(sheet,root);
  const listeners=[],held=new Set();let destroyed=false,enabled=true,lastTime=null,speedMultiplier=1;
  const listen=(target,type,fn,options)=>{target?.addEventListener(type,fn,options);listeners.push(()=>target?.removeEventListener(type,fn,options));};
  if(buttons){
    const title=doc.createElement('strong');title.textContent='Pan this view';root.append(title);
    const pad=doc.createElement('div');pad.className='map-controls-pad';root.append(pad);
    for(const [direction,glyph]of [['north','↑'],['west','←'],['east','→'],['south','↓']]){
      const button=doc.createElement('button');button.type='button';button.dataset.panDirection=direction;button.textContent=glyph;button.title=`Pan ${direction} one current ground-screen · no reload`;button.setAttribute('aria-label',`Pan map ${direction} one screen`);listen(button,'click',()=>panScreen(direction));pad.append(button);
    }
    const hint=doc.createElement('small');hint.textContent='Local pan · hold arrow keys';root.append(hint);
  }
  function stop(){held.clear();lastTime=null;}
  function editable(event){return isMapPanTypingTarget(event?.target)||isMapPanTypingTarget(doc.activeElement);}
  const modifiers=event=>event?.altKey||event?.ctrlKey||event?.metaKey||event?.shiftKey;
  function notify(dx,dz,direction,footprint,source){
    const detail={kind:'localPan',direction,dx,dz,source,footprint,camera:{position:{x:camera.position.x,y:camera.position.y,z:camera.position.z},target:{x:controls.target.x,y:controls.target.y,z:controls.target.z}}};
    onPan?.(detail);
    if(win?.CustomEvent)root.dispatchEvent(new win.CustomEvent('world:local-pan',{bubbles:true,detail}));
  }
  function canPan(){return enabled&&!destroyed&&doc.visibilityState!=='hidden'&&controls.enabled!==false;}
  function pan(direction,meters){
    const vector=DIRECTIONS[direction];if(!vector||!canPan()||!finite(meters)||meters<=0)return false;
    const dx=vector[0]*meters,dz=vector[1]*meters;if(!translateMapView(camera,controls,dx,dz))return false;notify(dx,dz,direction,null,'button');return true;
  }
  function getScreenFootprint(){return cameraGroundFootprint({camera,controls,THREE,groundY});}
  function getPanFootprint(){return cameraLocalPanFootprint({camera,controls,groundY});}
  function panScreen(direction){
    if(!DIRECTIONS[direction]||!canPan())return false;
    const footprint=getPanFootprint(),[x,z]=DIRECTIONS[direction],dx=x*footprint.width,dz=z*footprint.depth;
    if(!translateMapView(camera,controls,dx,dz))return false;notify(dx,dz,direction,footprint,'screen');return true;
  }
  listen(win,'keydown',event=>{
    if(modifiers(event)||editable(event)||event.defaultPrevented||!canPan()){stop();return;}
    if(KEYS[event.key]){held.add(event.key);event.preventDefault();}
  });
  listen(win,'keyup',event=>{if(KEYS[event.key])held.delete(event.key);if(modifiers(event))stop();});
  listen(win,'blur',stop);listen(doc,'visibilitychange',()=>{if(doc.visibilityState==='hidden')stop();});
  listen(doc,'focusin',event=>{if(editable(event))stop();});
  function setEnabled(value){enabled=Boolean(value);if(!enabled)stop();for(const b of root.querySelectorAll('button'))b.disabled=!enabled;}
  function update(value){
    if(destroyed)return;
    const now=typeof value==='number'?value:value?.now;
    if(typeof value?.enabled==='boolean')setEnabled(value.enabled);
    if(!finite(now)){lastTime=null;return;}
    const dt=lastTime===null?0:Math.min(.25,Math.max(0,(now-lastTime)/1000));lastTime=now;
    if(!canPan()||isMapPanTypingTarget(doc.activeElement)){stop();return;}
    let x=0,z=0;for(const key of held){const v=DIRECTIONS[KEYS[key]];x+=v[0];z+=v[1];}
    const magnitude=Math.hypot(x,z);if(!magnitude||!dt)return;
    const footprint=getPanFootprint(),speed=Number.isFinite(screensPerSecond)&&screensPerSecond>0?screensPerSecond:.8;
    const dx=x/magnitude*footprint.width*speed*speedMultiplier*dt,dz=z/magnitude*footprint.depth*speed*speedMultiplier*dt;
    if(translateMapView(camera,controls,dx,dz))notify(dx,dz,null,footprint,'keyboard');
  }
  function setSpeed(value){if(!finite(value)||value<.25||value>8)throw new RangeError('Camera speed must be 0.25–8.');speedMultiplier=value;}
  return{update,pan,panScreen,getScreenFootprint,getPanFootprint,setEnabled,setSpeed,destroy(){if(destroyed)return;destroyed=true;stop();for(const off of listeners)off();sheet.remove();root.remove();}};
}
