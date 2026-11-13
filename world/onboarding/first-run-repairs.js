/** Compact current playback facts; this does not compare separate model authorities. */
export function playbackFacts({mood, seed, living=false}={}) {
 return `${living?'Modeled utility':'Mood'}: ${Number.isFinite(mood)?mood.toFixed(0)+' / 100':'unavailable'} · Seed: ${seed??'unavailable'}`;
}
export function mountPlaybackFacts(document) {
 if(document.head){const style=document.createElement('link');style.rel='stylesheet';style.href=new URL('./first-run-repairs.css',import.meta.url).href;document.head.append(style);}
 const toolbar=document.getElementById('world-quick-toolbar');
 if(!toolbar)return {update(){}};
 const node=document.createElement('output');node.id='world-playback-facts';node.setAttribute('aria-label','Current playback mood and seed');
 Object.assign(node.style,{position:'absolute',top:'100%',right:'0',marginTop:'6px',padding:'5px 8px',borderRadius:'8px',background:'var(--panel)',color:'var(--ink)',fontSize:'12px',whiteSpace:'nowrap',pointerEvents:'none'});
 toolbar.append(node);
 return {update(value){const text=playbackFacts(value);if(node.textContent!==text)node.textContent=text;}};
}

/** An optional disclosure must leave loading even if an asset request stalls. */
export async function withMetadataDeadline(promise, milliseconds=10000) {
 let timer;
 try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Parameter provenance did not load. Reload to retry; simulation controls remain available.')),milliseconds);})]);}
 finally{clearTimeout(timer);}
}

/** Disabled controls keep their prerequisite visible for keyboard and touch users. */
export function mountControlReadiness(document,getReason,root=document.getElementById('top')) {
 if(!root)return {update(){},dispose(){}};
 const note=document.createElement('p');note.className='world-control-readiness';if(root.id==='top')note.id='world-control-readiness';note.setAttribute('role','status');root.append(note);
 const owned=new Map();
 function restore(control,record){
  for(const name of ['title','aria-description'])if(control.getAttribute(name)===record.applied){
   const original=record.original[name];if(original===null)control.removeAttribute(name);else control.setAttribute(name,original);
  }
 }
 function update(){
  const controls=[...root.querySelectorAll('button:disabled,select:disabled,input:disabled')].filter(node=>!node.closest('[hidden],[inert]')),active=new Set(controls),reasons=[];
  for(const [control,record] of owned)if(!active.has(control)){restore(control,record);owned.delete(control);}
  for(const control of controls){
   const reason=getReason(control);if(!reason){const record=owned.get(control);if(record){restore(control,record);owned.delete(control);}continue;}
   let record=owned.get(control);
   if(!record){record={original:{title:control.getAttribute('title'),'aria-description':control.getAttribute('aria-description')},applied:null};owned.set(control,record);}
   for(const name of ['title','aria-description']){
    const current=control.getAttribute(name);
    if(record.applied!==null&&current!==record.applied)record.original[name]=current;
    if(current!==reason)control.setAttribute(name,reason);
   }
   record.applied=reason;if(!reasons.includes(reason))reasons.push(reason);
  }
  const text=reasons.join(' ');if(note.textContent!==text)note.textContent=text;
  const hidden=!reasons.length;if(note.hidden!==hidden)note.hidden=hidden;
 }
 const Observer=document.defaultView?.MutationObserver??globalThis.MutationObserver;
 const observer=new Observer(update);observer.observe(root,{subtree:true,attributes:true,childList:true,attributeFilter:['disabled','hidden']});update();
 return {update,dispose(){observer.disconnect();for(const [control,record]of owned)restore(control,record);owned.clear();note.remove();}};
}
