import {cameraObstacles, planCameraPreset, navigablePose} from './camera-presets.js';

// Shell coordinates support illustrative framing only, never surveyed roof access.
export function buildingDestination(building, kind, buildings) {
  if (!building || building.kind === 'park' || building.id == null ||
      !Number.isFinite(building.height) || building.height < 3 || building.height > 1100 ||
      !Array.isArray(building.poly) || building.poly.length < 3 ||
      !building.poly.every(p => Array.isArray(p) && p.length >= 2 && p.slice(0,2).every(Number.isFinite))) return null;
  if (kind === 'rooftop' && building.roofAccess === false) return null;
  if (!['room','rooftop','skyline'].includes(kind)) return null;
  const xs=building.poly.map(p=>p[0]), zs=building.poly.map(p=>p[1]);
  const target={x:(Math.min(...xs)+Math.max(...xs))/2,y:kind==='room'?0:building.height,z:(Math.min(...zs)+Math.max(...zs))/2};
  return planCameraPreset(kind==='room'?'street':kind,target,cameraObstacles(buildings));
}

export function mountBuildingPerspective({container,camera,controls,getBuilding,getBuildings,getCutaway,setCutaway,stopGuidance}) {
  const doc=container.ownerDocument, root=doc.createElement('details');
  root.dataset.testid='building-perspective';
  root.innerHTML='<summary>Building perspective</summary><div></div><p role="status" aria-live="polite"></p><small>Illustrative room cutaway and roof framing; physical access is unverified.</small>';
  root.style.cssText='max-width:290px;padding:6px;background:#14292f;color:white;border-radius:8px';
  const row=root.querySelector('div'), status=root.querySelector('p'), buttons={};
  let saved=null, disposed=false, lastBuilding=undefined;
  const pose=()=>({position:{x:camera.position.x,y:camera.position.y,z:camera.position.z},target:{x:controls.target.x,y:controls.target.y,z:controls.target.z}});
  function apply(next) {
    const damping=controls.enableDamping; controls.enableDamping=false; controls.update();
    camera.position.set(next.position.x,next.position.y,next.position.z);
    controls.target.set(next.target.x,next.target.y,next.target.z);controls.update();controls.enableDamping=damping;
  }
  function refresh() {
    const building=getBuilding(), buildings=getBuildings();
    for(const kind of ['room','rooftop','skyline']) buttons[kind].disabled=!buildingDestination(building,kind,buildings);
    buttons.return.disabled=!saved;
    if(lastBuilding!==building) {lastBuilding=building;status.textContent=building?'Choose a building view. Unavailable destinations are disabled.':'Select a compatible building. Roof access unavailable.';}
    // A selection/authority change may disable the focused destination.
    if(Object.values(buttons).some(b=>b===doc.activeElement&&b.disabled))root.querySelector('summary').focus();
  }
  function choose(kind) {
    if(disposed)return false;
    const building=getBuilding(), buildings=getBuildings();
    const next=kind==='return'?saved?.pose:buildingDestination(building,kind,buildings);
    if(!next || (kind==='return'&&!navigablePose(next.position,cameraObstacles(buildings)))) {
      status.textContent='Destination unavailable. Current camera retained.';return false;
    }
    stopGuidance();
    if(kind==='return') {apply(next);setCutaway(saved.cutaway);saved=null;}
    else {saved??={pose:pose(),cutaway:getCutaway()};setCutaway(kind==='room');apply(next);}
    refresh();
    status.textContent=kind==='return'?'Previous camera restored.':`${buttons[kind].textContent} view. Selection and model time are unchanged by this control.`;
    (kind==='return'?root.querySelector('summary'):buttons[kind]).focus({preventScroll:true});
    return true;
  }
  for(const [kind,label] of [['room','Room detail'],['rooftop','Rooftop'],['skyline','Skyline'],['return','Return to previous view']]) {
    const button=doc.createElement('button');button.type='button';button.textContent=label;
    button.style.cssText='min-width:44px;min-height:44px;margin:3px';button.onclick=()=>choose(kind);buttons[kind]=button;row.append(button);
  }
  container.append(root);refresh();
  // Availability refreshes on disclosure/selection, with no per-frame pose search.
  root.addEventListener('toggle',refresh);
  return {choose,refresh,update(){if(getBuilding()!==lastBuilding)refresh();},element:root,dispose(){disposed=true;root.removeEventListener('toggle',refresh);root.remove();}};
}
