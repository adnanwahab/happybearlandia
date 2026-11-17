import {buildPedestrianNetwork} from './population/pedestrian-routes.js';
import {cameraObstacles} from './camera-presets.js';

// Presentation assumptions: six equal stations on one existing sidewalk, at most
// 12m per hop. No fallback route, junction crossing or resident command.
export function planStreetSteps(roads,origin) {
  if(!origin?.every(Number.isFinite))return null;
  let best=null;
  for(const lane of buildPedestrianNetwork(roads).lanes){
    const length=Math.hypot(lane.b[0]-lane.a[0],lane.b[1]-lane.a[1]);
    if(length<10)continue;
    for(const reverse of [false,true]){
      const a=reverse?lane.b:lane.a,b=reverse?lane.a:lane.b,d=Math.hypot(a[0]-origin[0],a[1]-origin[1]);
      if(d>80||best&&d>=best.distance)continue;
      const span=Math.min(60,length);
      best={distance:d,rulesVersion:'sidewalks.v1',points:Array.from({length:6},(_,i)=>a.map((v,k)=>v+(b[k]-v)*span/length*i/5))};
    }
  }
  return best;
}
export function clearStreetHop(a,b,boxes){
  if(!a||!b||![...a,...b].every(Number.isFinite))return false;
  return !boxes.some(box=>{
    if(box.top<8)return false;
    let lo=0,hi=1;
    for(const [k,min,max]of [[0,box.minX,box.maxX],[1,box.minZ,box.maxZ]]){
      const d=b[k]-a[k];if(!d){if(a[k]<min||a[k]>max)return false;}
      else{const t1=(min-a[k])/d,t2=(max-a[k])/d;lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));}
    }
    return lo<=hi;
  });
}
export function mountStreetSteps({container,camera,controls,canvas,getRoads,getBuildings,stopGuidance=()=>{},reducedMotion=()=>false,projectPoint=null}){
  const doc=container.ownerDocument,root=doc.createElement('details');root.dataset.testid='street-steps';
  root.innerHTML='<summary>Street steps</summary><p>Camera only · modeled sidewalks, not surveyed access.</p><button type="button">Find nearby sidewalk</button><div></div><button type="button">Skip animation</button><p role="status" aria-live="polite">Choose a nearby five-hop block.</p>';
  root.style.cssText='background:#14292f;color:white;padding:8px;max-width:290px';
  const [start,skip]=root.querySelectorAll('button'),row=root.querySelector('div'),status=root.querySelector('[role=status]');
  const overlay=doc.createElement('div');overlay.dataset.testid='street-step-stones';overlay.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:20';(canvas.parentElement??container).append(overlay);
  let plan=null,index=0,tween=null,disposed=false,last=null,lastLayout=-Infinity,ownGuidance=false;
  function stopOtherGuidance(){ownGuidance=true;try{stopGuidance();}finally{ownGuidance=false;}}
  const stats={frames:0,maxFrameMs:0,updateMs:0,overlayUpdates:0,overlayMs:0};
  function say(s){status.textContent=s;}
  function apply(point){const next=plan.points[Math.min(5,index+1)],prev=plan.points[Math.max(0,index-1)],dx=next[0]-prev[0],dz=next[1]-prev[1],length=Math.hypot(dx,dz)||1;
    const damping=controls.enableDamping;controls.enableDamping=false;controls.update();camera.position.set(point[0],8,point[1]);controls.target.set(point[0]+dx/length*8,0,point[1]+dz/length*8);controls.update();controls.enableDamping=damping;
  }
  function refresh(){row.replaceChildren();overlay.replaceChildren();lastLayout=-Infinity;skip.disabled=!tween;if(!plan)return;plan.points.slice(1).forEach((p,i)=>{const button=doc.createElement('button');button.type='button';const blocked=!clearStreetHop(plan.points[i],p,cameraObstacles(getBuildings()));button.textContent=`${i+1} → ${blocked?'Unavailable':'Step'}`;button.disabled=blocked||i!==index||!!tween;button.onclick=()=>hop(i);row.append(button);if(projectPoint){const stone=doc.createElement('button');stone.type='button';stone.textContent=blocked?`${i+1} ×`:`${i+1} →`;stone.setAttribute?.('aria-label',`Street step ${i+1}${blocked?' unavailable':''}`);stone.disabled=button.disabled;stone.style.cssText='position:absolute;min-width:44px;min-height:44px;border:3px solid #ffda65;border-radius:50%;background:#14292f;color:white;pointer-events:auto;transform:translate(-50%,-50%)';stone.onclick=()=>hop(i);overlay.append(stone);}});}
  function cancel(){if(tween||plan){tween=null;plan=null;last=null;refresh();say('Street steps stopped. Find a sidewalk to resume.');}}
  function hop(i){if(disposed||!plan||tween||i!==index)return false;
    if(!clearStreetHop(plan.points[i],plan.points[i+1],cameraObstacles(getBuildings()))){say('Step unavailable: blocked by loaded geometry.');refresh();return false;}
    stopOtherGuidance();last=null;index++;tween={from:plan.points[index-1],to:plan.points[index],start:null};if(reducedMotion())finish();refresh();return true;
  }
  function finish(){if(!tween)return;apply(tween.to);tween=null;say(`Step ${index} of 5${index===5?' complete.':'. Choose the next stone.'}`);refresh();}
  start.onclick=()=>{try{cancel();plan=planStreetSteps(getRoads(),[controls.target.x,controls.target.z]);index=0;if(!plan){say('Unavailable: no supported nearby sidewalk block.');return;}if(!clearStreetHop(plan.points[0],plan.points[0],cameraObstacles(getBuildings()))){plan=null;say('Unavailable: sidewalk entry is obstructed.');return;}stopOtherGuidance();apply(plan.points[0]);say('Sidewalk ready. Tap stones 1–5 to move the camera.');refresh();}catch{plan=null;tween=null;refresh();say('Unable to read sidewalk geometry. Try again.');}};
  skip.onclick=finish;
  const localPan=()=>{if(!ownGuidance)cancel();};doc.defaultView?.addEventListener('world:local-pan',localPan);
  const key=e=>{if(['Escape','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'].includes(e.key))cancel();};
  const otherCamera=e=>{if(e.target.closest?.('[data-testid=camera-presets]'))cancel();};doc.addEventListener('click',otherCamera,true);
  controls.addEventListener('start',cancel);canvas.addEventListener('pointerdown',cancel);canvas.addEventListener('wheel',cancel,{passive:true});doc.addEventListener('keydown',key);
  root.querySelectorAll('button').forEach(b=>b.style.cssText='min-width:44px;min-height:44px');
  const style=doc.createElement('style');style.textContent='[data-testid=street-steps] button{min-width:44px;min-height:44px;margin:3px}[data-testid=street-step-stones] :focus-visible,[data-testid=street-steps] :focus-visible{outline:3px solid #ffda65;outline-offset:2px}';root.append(style);container.append(root);refresh();
  return {element:root,stats,update(now){if(disposed)return;if(projectPoint&&plan&&now-lastLayout>=100){const layoutStart=performance.now();lastLayout=now;stats.overlayUpdates++;overlay.children&&Array.from(overlay.children).forEach((stone,i)=>{const p=projectPoint(plan.points[i+1]);stone.hidden=!p?.visible;if(p?.visible){stone.style.left=p.x+'px';stone.style.top=p.y+'px';}});stats.overlayMs+=performance.now()-layoutStart;}if(!tween)return;const begin=performance.now();if(last!==null)stats.maxFrameMs=Math.max(stats.maxFrameMs,now-last);last=now;stats.frames++;tween.start??=now;
    if(!clearStreetHop(tween.from,tween.to,cameraObstacles(getBuildings()))){cancel();say('Step stopped: geometry is now blocked.');return;}
    const t=reducedMotion()?1:Math.min(1,(now-tween.start)/450),u=t*t*(3-2*t);apply(tween.from.map((v,k)=>v+(tween.to[k]-v)*u));if(t===1){finish();last=null;}stats.updateMs+=performance.now()-begin;
  },dispose(){disposed=true;tween=null;plan=null;controls.removeEventListener('start',cancel);canvas.removeEventListener('pointerdown',cancel);canvas.removeEventListener('wheel',cancel);doc.defaultView?.removeEventListener('world:local-pan',localPan);doc.removeEventListener('keydown',key);doc.removeEventListener('click',otherCamera,true);overlay.remove();root.remove();}};
}
