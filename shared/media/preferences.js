/** OS motion preference plus a local override. Sound remains opt-in. */
export function createMediaPreferences(window) {
  let saved={};try{saved=JSON.parse(window.localStorage.getItem('hbl-media-v1'))||{};}catch{}
  const query=window.matchMedia('(prefers-reduced-motion: reduce)'),listeners=new Set();
  let motion=['system','reduce'].includes(saved.motion)?saved.motion:'system',volume=Number.isFinite(saved.volume)?Math.max(0,Math.min(1,saved.volume)):0;
  const get=()=>({motion,volume,reducedMotion:motion==='reduce'||query.matches});
  const emit=()=>{for(const fn of listeners)fn(get());};query.addEventListener('change',emit);
  return {get,set(value){if(['system','reduce'].includes(value.motion))motion=value.motion;if(Number.isFinite(value.volume))volume=Math.max(0,Math.min(1,value.volume));try{window.localStorage.setItem('hbl-media-v1',JSON.stringify({motion,volume}));}catch{}emit();},subscribe(fn){listeners.add(fn);fn(get());return()=>listeners.delete(fn);},dispose(){query.removeEventListener('change',emit);listeners.clear();}};
}

export function mountMediaControls(document,preferences) {
  const panel=document.createElement('div');panel.setAttribute('aria-label','Motion and sound settings');
  panel.style.cssText='position:fixed;bottom:12px;left:12px;z-index:1000;background:#142033;color:white;padding:10px;border-radius:8px;display:flex;flex-wrap:wrap;max-width:calc(100vw - 24px);box-sizing:border-box;gap:12px;align-items:center;font:14px sans-serif';
  const motion=document.createElement('input');motion.type='checkbox';motion.style.minHeight='24px';motion.style.minWidth='24px';
  const motionLabel=document.createElement('label');motionLabel.append(motion,' Reduce motion');
  const volume=document.createElement('input');volume.type='range';volume.style.minHeight='24px';volume.min=0;volume.max=1;volume.step=.05;volume.setAttribute('aria-label','Sound volume');
  const volumeLabel=document.createElement('label');volumeLabel.append('Sound volume ',volume);
  panel.append(motionLabel,volumeLabel);document.body.append(panel);
  motion.onchange=()=>preferences.set({motion:motion.checked?'reduce':'system'});volume.oninput=()=>preferences.set({volume:Number(volume.value)});
  const unsubscribe=preferences.subscribe(state=>{motion.checked=state.reducedMotion;volume.value=state.volume;});
  return()=>{unsubscribe();panel.remove();};
}
