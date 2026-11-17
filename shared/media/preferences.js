/** OS motion preference plus a local override. Sound remains opt-in. */
export function createMediaPreferences(window) {
  const defaults={motion:'system',volume:0,cameraEasing:true,parallax:true,confetti:true,particles:true,ambientSound:false,captions:true};
  const query=window.matchMedia('(prefers-reduced-motion: reduce)'),listeners=new Set();
  const normalize=value=>{const result={...defaults};if(value&&typeof value==='object'){if(['system','reduce'].includes(value.motion))result.motion=value.motion;if(Number.isFinite(value.volume))result.volume=Math.max(0,Math.min(1,value.volume));for(const key of Object.keys(defaults))if(typeof defaults[key]==='boolean'&&typeof value[key]==='boolean')result[key]=value[key];}return result;};
  let storageAvailable=true;
  const read=()=>{try{return normalize(JSON.parse(window.localStorage.getItem('hbl-media-v1')));}catch{storageAvailable=false;return {...defaults};}};
  let saved=read();
  const get=()=>{const reducedMotion=saved.motion==='reduce'||query.matches;return {...saved,reducedMotion,storageAvailable,...Object.fromEntries(['cameraEasing','parallax','confetti','particles'].map(key=>[key,saved[key]&&!reducedMotion]))};};
  const emit=()=>{for(const fn of listeners)fn(get());};
  const storage=event=>{if(event.key===null||event.key==='hbl-media-v1'){saved=read();emit();}};
  query.addEventListener('change',emit);window.addEventListener?.('storage',storage);
  const local=()=>{saved=read();emit();};window.addEventListener?.('hbl-media-change',local);
  const write=()=>{try{window.localStorage.setItem('hbl-media-v1',JSON.stringify(saved));storageAvailable=true;if(window.Event)window.dispatchEvent?.(new window.Event('hbl-media-change'));}catch{storageAvailable=false;}emit();};
  return {get,set(value){saved=normalize({...saved,...value});write();},reset(){saved={...defaults};write();},subscribe(fn){listeners.add(fn);fn(get());return()=>listeners.delete(fn);},dispose(){query.removeEventListener('change',emit);window.removeEventListener?.('storage',storage);window.removeEventListener?.('hbl-media-change',local);listeners.clear();}};
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

/** Normal-flow native controls; essential evidence and status text are never hidden. */
export function mountComfortStudio(document,preferences) {
  const panel=document.createElement('details'),summary=document.createElement('summary');
  panel.dataset.comfortStudio='';summary.textContent='Motion and audio comfort';
  panel.style.cssText='margin:16px;padding:12px;border:1px solid #8093ac;border-radius:8px;background:#142033;color:white;font:14px system-ui';
  const note=document.createElement('p');note.textContent='Presentation only. Native reduced motion always takes priority. Ambient audio requires a local activation. Essential evidence and status text stay visible.';
  panel.append(summary,note);
  const inputs={};
  for(const [key,title] of Object.entries({cameraEasing:'Camera easing',parallax:'Parallax',confetti:'Confetti',particles:'Particles',ambientSound:'Ambient sound',captions:'Optional audio captions'})) {
    const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.dataset.comfort=key;input.style.cssText='min-width:24px;min-height:24px;width:auto';label.style.cssText='display:flex;align-items:center;gap:10px;min-height:44px';label.append(input,title);panel.append(label);inputs[key]=input;input.onchange=()=>preferences.set({[key]:input.checked});
  }
  const reset=document.createElement('button');reset.type='button';reset.textContent='Reset to system defaults';reset.style.minHeight='44px';reset.onclick=()=>preferences.reset();
  const status=document.createElement('p');status.setAttribute('role','status');
  const unsubscribe=preferences.subscribe(state=>{for(const [key,input] of Object.entries(inputs)){input.checked=state[key];input.disabled=state.reducedMotion&&['cameraEasing','parallax','confetti','particles'].includes(key);}status.textContent=(state.reducedMotion?'Reduced motion is active. ':'')+(state.storageAvailable?'Preferences saved on this device.':'Storage unavailable; preferences apply for this visit.');});
  panel.append(reset,status);panel.addEventListener('keydown',event=>{if(event.key==='Escape'){panel.open=false;summary.focus();}});document.body.append(panel);
  return ()=>{unsubscribe();panel.remove();};
}
