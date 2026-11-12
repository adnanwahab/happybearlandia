/** Start the full 3D renderer only when supported; Canvas2D never imports Three. */
const params=new URLSearchParams(location.search);
const requested=params.get('renderer');
const canvasMode=requested==='canvas2d'||requested==='lite'||requested==='2d';
function hasWebGL2(){
  try{const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl2');const ok=!!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();return ok;}catch{return false;}
}
const fallback=()=>{
  document.documentElement.dataset.renderer='canvas2d';
  const gi=document.getElementById('global-illumination-button');if(gi){gi.dataset.state='UNAVAILABLE';gi.title='Requires WebGPU. Direct lighting remains available.';}
  return import('./canvas2d-world.js');
};
const link=document.getElementById('world-lite-link');
if(link){
  const url=new URL(location.href);url.searchParams.set('renderer',canvasMode?'webgl':'canvas2d');
  link.href=url.pathname+url.search+url.hash;
  link.textContent=canvasMode?'Try 3D rendering':'Use 2D low-fidelity mode';
}
// Saved checkpoints require the restoring renderer and its own Canvas2D fallback.
// The standalone low-fidelity scene cannot reconstruct Living Population saves.
if(params.has('experiment')){
  import('./render.js').catch(error=>console.warn('[world] Saved renderer unavailable; retain its recovery view:',error));
}else if(canvasMode||(!navigator.gpu&&!hasWebGL2())){
  fallback().catch(error=>{const el=document.getElementById('loading');if(el)el.textContent='2D World could not start: '+error.message;});
}else{
  import('./render.js').catch(error=>{
    console.warn('[world] 3D module unavailable, trying Canvas2D:',error);
    const el=document.getElementById('loading');if(el)el.textContent='3D unavailable. Switching to low-fidelity Canvas2D…';
    return fallback();
  }).catch(error=>{const el=document.getElementById('loading');if(el)el.textContent='No supported renderer could load: '+error.message;});
}
