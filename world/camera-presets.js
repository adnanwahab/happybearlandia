/** Presentation-only cuts. Conservative boxes include a 3m navigation margin.
 * Authored offsets are photographic framing assumptions, not surveyed access.
 */
export function cameraObstacles(buildings) {
  return buildings.filter(b=>b.kind!=='park'&&b.poly?.length&&Number.isFinite(b.height)).map(b=>({
    minX:Math.min(...b.poly.map(p=>p[0]))-3,maxX:Math.max(...b.poly.map(p=>p[0]))+3,
    minZ:Math.min(...b.poly.map(p=>p[1]))-3,maxZ:Math.max(...b.poly.map(p=>p[1]))+3,top:b.height+3
  }));
}
const finite=p=>p&&['x','y','z'].every(k=>Number.isFinite(p[k]));
export function navigablePose(p,boxes) {
  return finite(p)&&p.y>=3&&p.y<=1200&&!boxes.some(b=>p.x>=b.minX&&p.x<=b.maxX&&p.z>=b.minZ&&p.z<=b.maxZ&&p.y<=b.top);
}
export function planCameraPreset(kind,target,boxes,heading=0) {
  if(!finite(target)||Math.abs(target.x)>100000||Math.abs(target.z)>100000||!['street','rooftop','skyline','follow'].includes(kind))return null;
  const nearby=boxes.filter(b=>target.x>=b.minX-180&&target.x<=b.maxX+180&&target.z>=b.minZ-180&&target.z<=b.maxZ+180);
  const roof=Math.max(12,...nearby.map(b=>b.top));
  const y=kind==='street'?5:kind==='skyline'?Math.max(160,roof+70):Math.max(32,roof+8);
  const radius=kind==='street'?28:kind==='skyline'?220:60;
  const aim={x:target.x,y:kind==='street'?0:Math.min(target.y, y-5),z:target.z};
  for(let ring=1;ring<=3;ring++)for(let i=0;i<16;i++){
    const angle=heading+i*Math.PI/8,position={x:target.x+Math.sin(angle)*radius*ring,y,z:target.z+Math.cos(angle)*radius*ring};
    // Keep a downward viewing angle compatible with OrbitControls' polar bound.
    if(Math.atan2(Math.hypot(position.x-aim.x,position.z-aim.z),position.y-aim.y)>Math.PI*.47)continue;
    if(navigablePose(position,boxes))return {position,target:aim};
  }
  return null;
}
export function mountCameraPresets({container,camera,controls,canvas,getBuildings,getSubject,stopGuidance=()=>{},reducedMotion=()=>false}) {
  const doc=container.ownerDocument,root=doc.createElement('details');root.dataset.testid='camera-presets';
  root.innerHTML='<summary>Camera</summary><div style="display:flex;flex-wrap:wrap;gap:6px;max-width:280px"></div><p role="status" aria-live="polite">Choose a view. Follow needs a selected resident.</p>';
  root.style.cssText='padding:6px;background:#14292f;color:#fff;border-radius:8px;max-width:290px';
  const row=root.querySelector('div'),status=root.querySelector('p');status.style.cssText='font-size:12px;max-width:270px;margin:6px 0';
  let saved=null,active=null,subjectKey=null,disposed=false,boxes=[],lastBoxes=-Infinity;
  const buttons={};
  function obstacles(now=performance.now()){if(now-lastBoxes>500){boxes=cameraObstacles(getBuildings());lastBoxes=now;}return boxes;}
  function stop(message='Camera movement interrupted.'){active=null;subjectKey=null;status.textContent=message;}
  function apply(pose){const damping=controls.enableDamping;controls.enableDamping=false;controls.update();camera.position.set(...['x','y','z'].map(k=>pose.position[k]));controls.target.set(...['x','y','z'].map(k=>pose.target[k]));controls.update();controls.enableDamping=damping;}
  function choose(kind){
    if(disposed)return false;
    if(kind==='return'){
      if(!saved)return false;
      lastBoxes=-Infinity;
      if(!navigablePose(saved.position,obstacles())){stop('Previous view is now obstructed. Move the camera manually.');return false;}
      stopGuidance();stop('Returned to previous view.');apply(saved);saved=null;buttons.return.disabled=true;return true;
    }
    const subject=getSubject(),target=subject?.position??{x:controls.target.x,y:controls.target.y,z:controls.target.z};
    if(kind==='follow'&&!subject){stop('Follow unavailable. Select a visible resident.');return false;}
    lastBoxes=-Infinity;
    const heading=Math.atan2(camera.position.x-controls.target.x,camera.position.z-controls.target.z);
    const pose=planCameraPreset(kind,target,obstacles(),heading);
    if(!pose){stop('No safe camera pose available here. Move to another place.');return false;}
    saved??={position:{x:camera.position.x,y:camera.position.y,z:camera.position.z},target:{x:controls.target.x,y:controls.target.y,z:controls.target.z}};
    stopGuidance();apply(pose);buttons.return.disabled=false;
    active=kind==='follow'&&!reducedMotion()?'follow':null;subjectKey=subject?.key;
    status.textContent=kind==='follow'?(active?'Following selected resident. Drag, scroll or press Escape to stop.':'Resident framed. Reduced motion keeps the view still.'):`${kind[0].toUpperCase()+kind.slice(1)} view. Return restores your previous camera.`;
    return true;
  }
  for(const kind of ['street','rooftop','skyline','follow','return']){const button=doc.createElement('button');button.type='button';button.textContent=kind[0].toUpperCase()+kind.slice(1);button.style.cssText='min-height:44px;min-width:44px';button.onclick=()=>choose(kind);buttons[kind]=button;row.append(button);}buttons.return.disabled=true;
  const interrupt=()=>{if(active)stop();};
  const win=doc.defaultView;win.addEventListener('world:local-pan',interrupt);
  const key=event=>{if(event.key==='Escape'||['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'].includes(event.key))interrupt();};
  controls.addEventListener('start',interrupt);canvas.addEventListener('pointerdown',interrupt);canvas.addEventListener('wheel',interrupt,{passive:true});doc.addEventListener('keydown',key);
  container.append(root);
  return {choose,element:root,update(now){if(!active||disposed)return;if(reducedMotion()){stop('Reduced motion keeps the view still.');return;}const subject=getSubject();if(!subject||subject.key!==subjectKey){stop('Follow stopped: selection or position changed.');return;}const heading=Math.atan2(camera.position.x-controls.target.x,camera.position.z-controls.target.z),pose=planCameraPreset('follow',subject.position,obstacles(now),heading);if(!pose){stop('Follow stopped: no safe pose.');return;}apply(pose);},dispose(){disposed=true;controls.removeEventListener('start',interrupt);canvas.removeEventListener('pointerdown',interrupt);canvas.removeEventListener('wheel',interrupt);doc.removeEventListener('keydown',key);win.removeEventListener('world:local-pan',interrupt);root.remove();}};
}
