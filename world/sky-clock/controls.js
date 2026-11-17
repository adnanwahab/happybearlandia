const time=hour=>{const minute=Math.floor(hour*60+1e-7);return `${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`;};
export function skyClockState(minute,preview){
 const valid=Number.isFinite(minute),cosmetic=Number.isFinite(preview);
 return {valid,cosmetic,hour:cosmetic?preview:valid?((minute%1440)+1440)%1440/60:0,
 committed:valid?`Committed simulation time · day ${Math.floor(minute/1440)+1} · ${time(((minute%1440)+1440)%1440/60)}`:'Committed simulation time unavailable',
 label:cosmetic?'Cosmetic lighting preview':'Current scene lighting',
 note:'No hourly recorded state is available here. Solar colors are authored; residents, weather and run receipts stay at committed simulation time.'};
}
export function mountSkyClock(parent,{read,preview,reset,now=()=>performance.now()}){
 const document=parent.ownerDocument;
 const root=document.createElement('details');root.dataset.testid='sky-clock';
 root.innerHTML='<summary>☀ Sky clock · visual preview</summary><p data-committed></p><svg viewBox="0 0 240 86" width="240" height="86" aria-hidden="true"><path d="M20 68 A100 50 0 0 1 220 68" fill="none" stroke="currentColor"/><circle data-sun r="9" fill="#ffce69"/><text x="4" y="84" fill="currentColor" font-size="12">00:00</text><text x="100" y="84" fill="currentColor" font-size="12">12:00</text><text x="204" y="84" fill="currentColor" font-size="12">24:00</text></svg><label>Preview hour <input type="range" min="0" max="23.75" step="0.25" aria-label="Cosmetic lighting preview hour"></label><output></output><p data-note></p><button type="button">Reset to committed time</button><p role="status"></p>';
 const style=document.createElement('style');style.textContent='[data-testid="sky-clock"]{max-width:100%;margin:8px 0}[data-testid="sky-clock"] input{width:100%;min-height:44px}[data-testid="sky-clock"] button{min-height:44px}[data-testid="sky-clock"] :focus-visible{outline:3px solid #ffce69;outline-offset:3px}[data-testid="sky-clock"] svg{max-width:100%;display:block}';root.append(style);parent.append(root);
 const input=root.querySelector('input'),button=root.querySelector('button'),status=root.querySelector('[role=status]');
 let disposed=false,last=-Infinity,key='',updates=0,failures=0,cpuMs=0,frames=0,lastFrame=null,maxFrameMs=0,readFailed=false;
 function update(timestamp=now(),force=false){
  if(disposed)return;
  if(!force){frames++;if(lastFrame!==null)maxFrameMs=Math.max(maxFrameMs,Math.max(0,timestamp-lastFrame));lastFrame=timestamp;}
  if(!force&&timestamp-last<100)return;last=timestamp;const start=now();
  try{const state=read();if(readFailed){status.textContent='Lighting controls restored.';readFailed=false;}const view=skyClockState(state.minute,state.hour);const next=JSON.stringify(view);input.disabled=!view.valid;button.disabled=!view.valid;
   if(next!==key){key=next;root.querySelector('[data-committed]').textContent=view.committed;root.querySelector('[data-note]').textContent=view.note;root.querySelector('output').textContent=view.valid?`${view.label} · ${time(view.hour)}`:'Lighting unavailable';root.querySelector('svg').setAttribute('visibility',view.valid?'visible':'hidden');input.value=String(view.hour);input.setAttribute('aria-valuetext',`${time(view.hour)} · ${view.label}`);const angle=view.hour/24*Math.PI;const sun=root.querySelector('[data-sun]');sun.setAttribute('cx',String(120-100*Math.cos(angle)));sun.setAttribute('cy',String(68-50*Math.sin(angle)));updates++;}
  }catch{failures++;readFailed=true;input.disabled=button.disabled=true;status.textContent='Lighting controls unavailable. Simulation state has not been changed.';}
  cpuMs+=Math.max(0,now()-start);
 }
 function change(){try{preview(Number(input.value));status.textContent='Cosmetic preview only. Simulation time is unchanged.';update(now(),true);}catch{failures++;status.textContent='Lighting preview failed. Reset to retry; simulation time is unchanged.';}}
 function restore(){try{reset();status.textContent='Following committed simulation time.';update(now(),true);}catch{failures++;status.textContent='Lighting reset failed. Simulation time is unchanged.';}}
 input.addEventListener('input',change);button.addEventListener('click',restore);update(0,true);
 return{element:root,update,getStats:()=>({updates,failures,cpuMs,frames,maxFrameMs,disposed,intervalMs:100}),destroy(){disposed=true;input.removeEventListener('input',change);button.removeEventListener('click',restore);root.remove();}};
}
