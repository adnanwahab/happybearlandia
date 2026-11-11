/** Camera guidance for an explicitly resolved scene entity. No RAF or model mapping.
 * resolveEntity({authority,kind,id}) -> {position:{x,y?,z},visible?:boolean}|null.
 * Call update(nowMilliseconds) from the existing render loop. Camera offsets are
 * presentation only; entity locations must come from the active scene runtime.
 */
export function scenePosition(entity) {
  const p=entity?.position;
  if(entity?.visible===false||!p||!Number.isFinite(p.x)||!Number.isFinite(p.z)||(p.y!==undefined&&!Number.isFinite(p.y)))return null;
  return {x:p.x,y:p.y??0,z:p.z};
}
export function sceneEntityReference(ref) {
  return Boolean(ref&&typeof ref.authority==='string'&&ref.authority.length&&['resident','building'].includes(ref.kind)&&['string','number'].includes(typeof ref.id)&&String(ref.id).length&&(typeof ref.id!=='number'||Number.isFinite(ref.id)));
}
export function createCameraDirector({camera,controls,resolveEntity,getResidentPosition,now=()=>globalThis.performance?.now?.()??Date.now(),reducedMotion=false,available=true,offset={x:32,y:28,z:40},onChange=()=>{}}={}) {
  const resolveSceneEntity=resolveEntity??(ref=>ref.authority==='legacy-world'&&ref.kind==='resident'&&getResidentPosition?{position:getResidentPosition(ref.id)}:null);
  let disposed=false,reference=null,lastTime=null,snapped=false,reason='idle';
  const listeners=[];
  const usable=()=>available&&camera?.position&&controls?.target&&[offset.x,offset.y,offset.z].every(Number.isFinite);
  const state=()=>({active:reference!==null,reference:reference?{...reference}:null,reason});
  function stop(why='cancelled') {const wasActive=reference!==null;reference=null;lastTime=null;snapped=false;reason=why;if(wasActive)onChange(state());return wasActive;}
  function resolve(ref){try{return scenePosition(resolveSceneEntity(ref));}catch{return null;}}
  function focus(ref) {
    if(disposed)return false;
    stop('replaced');
    if(!usable()||!sceneEntityReference(ref)){reason='unavailable';return false;}
    const next={authority:ref.authority,kind:ref.kind,id:ref.id};
    if(!resolve(next)){reason='entity-unavailable';return false;}
    reference=next;reason='following';onChange(state());update();return true;
  }
  function update(time=now()) {
    if(disposed||!reference)return false;
    if(!usable()){stop('unavailable');return false;}
    const p=resolve(reference);if(!p){stop('entity-unavailable');return false;}
    const reduced=typeof reducedMotion==='function'?reducedMotion():reducedMotion;
    // A reduced-motion user gets one static framing, with no continuous pursuit.
    if(reduced&&snapped)return true;
    const dt=Number.isFinite(time)&&lastTime!==null?Math.min(.1,Math.max(0,(time-lastTime)/1000)):0;
    lastTime=Number.isFinite(time)?time:null;
    const alpha=!snapped||reduced?1:1-Math.exp(-dt*8);
    for(const axis of ['x','y','z']){
      controls.target[axis]+=(p[axis]-controls.target[axis])*alpha;
      camera.position[axis]+=(p[axis]+offset[axis]-camera.position[axis])*alpha;
    }
    snapped=true;controls.update?.();camera.updateMatrixWorld?.();return true;
  }
  const interrupt=()=>stop('manual-interruption');
  controls?.addEventListener?.('start',interrupt);
  listeners.push(()=>controls?.removeEventListener?.('start',interrupt));
  return {focusResident:id=>focus({authority:'legacy-world',kind:'resident',id}),focus,follow:focus,update,stop,cancel:stop,interrupt,getState:state,dispose(){if(disposed)return;stop('disposed');disposed=true;for(const off of listeners)off();}};
}
