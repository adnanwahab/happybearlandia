import {mountCityXray} from './city-xray/app.js';
const cityXray=new URLSearchParams(location.search).get('embed')==='1'?null:mountCityXray();
import {cityViewURL} from './static-city-model.js';
const params=new URLSearchParams(location.search);
const cityLink=document.getElementById('city-view-link');if(cityLink)cityLink.href=cityViewURL(location.href,'requested');let leaving=false;
window.addEventListener('pagehide',()=>{leaving=true;const prepared=window.hblPreparedWorldGraphics;if(prepared){delete window.hblPreparedWorldGraphics;prepared.renderer.dispose();}},{once:true});
const preview=reason=>{window.addEventListener('pageswap',event=>{const pending=event.viewTransition;if(pending){void pending.ready.catch(()=>{});void pending.finished.catch(()=>{});pending.skipTransition();}},{once:true});const transition=document.activeViewTransition;if(transition){void transition.ready.catch(()=>{});void transition.finished.catch(()=>{});transition.skipTransition();}location.replace(cityViewURL(location.href,reason));};
function showGameError(error){const loading=document.getElementById('loading');if(loading&&!loading.querySelector('button')){loading.replaceChildren();loading.setAttribute('role','alert');const message=document.createElement('p');message.textContent='The game could not start. Try again, or open the city view without simulation.';const retry=document.createElement('button');retry.type='button';retry.textContent='Try again';retry.onclick=()=>location.reload();const view=document.createElement('a');view.href=cityViewURL(location.href,'initialization');view.textContent='Open city view';loading.append(message,retry,view);}console.error('[world] Game initialization failed:',error);}
async function start(){
 if(params.get('renderer')==='webgl2'){preview('requested');return;}
 if(!navigator.gpu){cityXray?.setUnavailable('Native WebGPU unavailable');preview('unavailable');return;}
 let prepared,timer,expired=false;
 try{
  const{createWorldGPU}=await import('./world-gpu.js');const work=createWorldGPU({antialias:params.get('embed')!=='1'});work.then(value=>{if(expired||leaving)value.renderer.dispose();}).catch(()=>{});
  prepared=await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;reject(Error('WebGPU initialization timed out.'));},8000);})]);
 }catch{preview('initialization');return;}finally{clearTimeout(timer);}
 // render.js consumes this already initialized native backend. Preflight happens
 // before its simulation imports so the fallback never loads a simulation graph.
 if(leaving)return;
 window.hblPreparedWorldGraphics=prepared;document.documentElement.dataset.renderer='webgpu';
 try{await import('./render.js');}catch(error){if(window.hblPreparedWorldGraphics){delete window.hblPreparedWorldGraphics;prepared.renderer.dispose();}showGameError(error);}
}
void start();
