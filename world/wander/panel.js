import {createWanderRoute,createWanderController} from './route.js';

export function mountWander({town,move,rendered=()=>true,beforeStart=()=>{},manual=false}) {
  const host=document.getElementById('wander-panel');
  const start=document.getElementById('wander-start'),next=document.getElementById('wander-next'),end=document.getElementById('wander-end'),status=document.getElementById('wander-status');
  let round=0,activeRound=0,cachedRound=-1,cachedRoute=null;
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const getRoute=()=>{
    if(cachedRound!==activeRound){cachedRound=activeRound;cachedRoute=createWanderRoute(town,{round:activeRound,rendered});}
    if(!cachedRoute||town.buildings.some(b=>b.state?.flooded||b.blocked)||cachedRoute.stops.some(s=>!town.buildings.some(b=>b.id===s.landmarkId&&rendered(b))))return null;
    return cachedRoute;
  };
  const controller=createWanderController({getRoute,move,manual:()=>manual||motion.matches,onChange:s=>{
    const restoreFocus=!s.active&&(document.activeElement===next||document.activeElement===end);
    start.hidden=s.active;next.hidden=end.hidden=!s.active;if(restoreFocus)start.focus();
    status.textContent=s.active?`Stop ${s.index+1} of 4: near ${s.route.stops[s.index].label}. Look at the street and building shapes.${manual||motion.matches?' Use Next stop for static views.':''}`:s.reason==='complete'?'Stroll complete. Wander again for another bounded route.':s.reason==='unavailable'?'Wander unavailable: no fully supported, rendered route.':'Wander stopped. You control the view.';
  }});
  const begin=()=>{beforeStart();activeRound=round++;if(controller.start())next.focus();};
  const advance=()=>controller.next(),stop=()=>controller.stop();
  const endStroll=()=>{stop();start.focus();};
  const interrupt=e=>{if(!host.contains(e.target)&&controller.getState().active)stop();};
  const keyboard=e=>{if(e.key==='Escape'||!host.contains(e.target))interrupt(e.key==='Escape'?{target:document.body}:e);};
  start.addEventListener('click',begin);next.addEventListener('click',advance);end.addEventListener('click',endStroll);
  document.addEventListener('pointerdown',interrupt,true);document.addEventListener('wheel',interrupt,true);document.addEventListener('keydown',keyboard,true);
  const collapse=()=>{if(!host.open&&controller.getState().active)stop();};host.addEventListener('toggle',collapse);
  const visibility=()=>{if(document.hidden)stop();};document.addEventListener('visibilitychange',visibility);
  const unavailable=!getRoute();start.disabled=unavailable;if(!unavailable)status.textContent='Start a short stroll through this procedural neighborhood.';if(unavailable)status.textContent='Wander unavailable: sourced maps need verified access; missing, blocked or hidden geometry is excluded.';
  return {update:controller.update,getState:controller.getState,stop,destroy(){stop();host.removeEventListener('toggle',collapse);start.removeEventListener('click',begin);next.removeEventListener('click',advance);end.removeEventListener('click',endStroll);document.removeEventListener('pointerdown',interrupt,true);document.removeEventListener('wheel',interrupt,true);document.removeEventListener('keydown',keyboard,true);document.removeEventListener('visibilitychange',visibility);}};
}
