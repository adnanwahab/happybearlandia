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
export function mountControlReadiness(document,getReason) {
 const root=document.getElementById('top');if(!root)return {dispose(){}};
 const note=document.createElement('p');note.id='world-control-readiness';note.setAttribute('role','status');root.append(note);
 function update(){const controls=[...root.querySelectorAll('button:disabled,select:disabled,input:disabled')].filter(node=>!node.hidden);const reasons=[];
  for(const control of controls){const reason=getReason(control);control.title=reason;control.setAttribute('aria-description',reason);if(!reasons.includes(reason))reasons.push(reason);}
  note.textContent=reasons.join(' ');const hidden=!reasons.length;if(note.hidden!==hidden)note.hidden=hidden;
 }
 const observer=new MutationObserver(update);observer.observe(root,{subtree:true,attributes:true,attributeFilter:['disabled','hidden']});update();
 return {dispose(){observer.disconnect();note.remove();}};
}
