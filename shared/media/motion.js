import {createMediaPreferences} from './preferences.js';

// Presentation milliseconds only: never use these values as simulation time.
export const motionTokens = Object.freeze({
  duration: Object.freeze({instant:0, feedback:180, transition:250}),
  easing: Object.freeze({standard:'cubic-bezier(0.2, 0, 0, 1)'}),
  layer: Object.freeze({content:0, navigation:90, inspector:1000}),
});

/** Latest request wins. Prepare asynchronously; commit/rollback must be synchronous.
 * Async preparation must honor signal and must not mutate the visible scene.
 */
export function createMotionAdapter({document, preferences, timeoutMs=5000}) {
  let active=null, disposed=false;
  const skip=job=>{if(job?.capture&&!job.skipped){job.skipped=true;try{job.capture.skipTransition();}catch{}}};
  const cancel=()=>{if(active){active.controller.abort();skip(active);active=null;}};
  const unsubscribe=preferences.subscribe(({reducedMotion})=>{if(reducedMotion)skip(active);});
  return {
    async transition(update,{focus,prepare,rollback}={}) {
      if(disposed)throw new Error('Motion adapter disposed');
      cancel();
      const job={controller:new AbortController(),capture:null};active=job;
      const {signal}=job.controller;
      let called=false, committed=false, result, timer;
      const aborted=new Promise(resolve=>signal.addEventListener('abort',()=>resolve(false),{once:true}));
      const commit=()=>{
        if(called)return result;
        called=true;
        if(signal.aborted)return;
        result=Promise.resolve().then(()=>{if(!signal.aborted)return update(signal);});
        return result;
      };
      try {
        const work=(async()=>{
          if(prepare)await prepare(signal);
          if(signal.aborted)return false;
          if(!preferences.get().reducedMotion&&typeof document.startViewTransition==='function') {
            try{job.capture=document.startViewTransition(commit);}catch{/* Commit without capture. */}
          }
          if(job.capture){
            job.capture.ready.catch(()=>{});
            await job.capture.updateCallbackDone;
          } else await commit();
          if(signal.aborted)return false;
          committed=true;
          focus?.focus({preventScroll:true});
          if(job.capture)await job.capture.finished.catch(()=>{});
          return !signal.aborted;
        })();
        const deadline=new Promise((resolve,reject)=>{timer=setTimeout(()=>committed?resolve(true):reject(new Error('View transition timed out')),timeoutMs);});
        return await Promise.race([work,aborted,deadline]);
      } catch(error) {
        if(!signal.aborted)rollback?.(error);
        throw error;
      } finally {
        clearTimeout(timer);
        if(active===job){skip(job);job.controller.abort();active=null;}
      }
    },
    cancel,
    dispose(){disposed=true;cancel();unsubscribe();},
  };
}

export function mountMotion(document) {
  const win=document.defaultView, root=document.documentElement;
  const preferences=createMediaPreferences(win);
  const style=document.createElement('style');
  style.textContent=`@view-transition{navigation:auto}
:root{${Object.entries(motionTokens).flatMap(([group,values])=>Object.entries(values).map(([key,value])=>`--hbl-${group}-${key}:${value}${group==='duration'?'ms':''};`)).join('')}}
::view-transition-old(root),::view-transition-new(root){animation-duration:var(--hbl-duration-transition);animation-timing-function:var(--hbl-easing-standard)}
html[data-hbl-reduced-motion]::view-transition-old(root),html[data-hbl-reduced-motion]::view-transition-new(root){animation:none}
html[data-hbl-reduced-motion] .gallery-card,html[data-hbl-reduced-motion] .decision-viz,html[data-hbl-reduced-motion] button{transition:none!important}
html[data-hbl-reduced-motion] .launch h1{animation:none!important}
@media(prefers-reduced-motion:reduce){::view-transition-old(root),::view-transition-new(root){animation:none}}`;
  document.head.append(style);
  const unsubscribe=preferences.subscribe(s=>root.toggleAttribute('data-hbl-reduced-motion',s.reducedMotion));
  const adapter=createMotionAdapter({document,preferences});
  // Native disclosure stays in normal flow; it cannot cover application controls.
  const panel=document.createElement('details');panel.dataset.motionInspector='';
  panel.style.cssText='margin:16px;padding:12px;background:#142033;color:#fff;border:1px solid #8093ac;border-radius:8px;font:14px system-ui;position:relative;z-index:var(--hbl-layer-content)';
  const summary=document.createElement('summary');summary.textContent='Transition inspector';
  const info=document.createElement('pre');info.style.whiteSpace='pre-wrap';info.textContent=JSON.stringify(motionTokens,null,2);
  const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';label.append(check,' Reduce motion');
  check.onchange=()=>preferences.set({motion:check.checked?'reduce':'system'});
  const sync=preferences.subscribe(s=>{check.checked=s.reducedMotion;});
  const status=document.createElement('p');status.setAttribute('role','status');status.textContent='Presentation only. Simulation clocks and recorded evidence are unchanged.';
  const preview=document.createElement('button');preview.type='button';preview.textContent='Preview transition';
  let count=0;
  preview.onclick=()=>adapter.transition(()=>{status.textContent=`Presentation preview ${++count}. No simulation state changed.`;},{focus:preview});
  panel.append(summary,label,info,preview,status);document.body.append(panel);
  panel.addEventListener('keydown',e=>{if(e.key==='Escape'){panel.open=false;summary.focus();}});
  return {adapter,dispose(){adapter.dispose();sync();unsubscribe();preferences.dispose();panel.remove();style.remove();root.removeAttribute('data-hbl-reduced-motion');}};
}
