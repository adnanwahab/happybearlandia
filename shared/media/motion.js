import {createMediaPreferences} from './preferences.js';

// Presentation milliseconds only: never use these values as simulation time.
export const motionTokens = Object.freeze({
  duration: Object.freeze({instant:0, feedback:180, transition:250}),
  easing: Object.freeze({standard:'cubic-bezier(0.2, 0, 0, 1)'}),
  layer: Object.freeze({content:0, navigation:90, inspector:1000}),
});

/** Runs an update exactly once. Unsupported/reduced motion commits immediately. */
export function createMotionAdapter({document, preferences}) {
  let active=null, disposed=false;
  const unsubscribe=preferences.subscribe(({reducedMotion})=>{if(reducedMotion)active?.skipTransition();});
  return {
    async transition(update,{focus}={}) {
      if(disposed)throw new Error('Motion adapter disposed');
      // Concurrent UI commands commit immediately rather than capture stale DOM.
      let called=false, result;
      const commit=()=>{if(!called){called=true;result=Promise.resolve().then(update);}return result;};
      let transition;
      if(!active&&!preferences.get().reducedMotion&&typeof document.startViewTransition==='function') {
        try{transition=document.startViewTransition(commit);active=transition;}catch{/* Unsupported capture: still commit once. */}
      }
      try {
        if(transition){transition.ready.catch(()=>{});await transition.updateCallbackDone;await transition.finished.catch(()=>{});}
        else await commit();
        focus?.focus({preventScroll:true});
      } finally {if(active===transition)active=null;}
    },
    dispose(){disposed=true;active?.skipTransition();unsubscribe();},
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
