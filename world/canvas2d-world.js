/** Explicitly low-fidelity World. Reuses the legacy seeded town and simulation,
 * replacing only Three/WebGPU visuals with Canvas2D for restricted browsers.
 * The monthly City and Living Population engines are separate authorities.
 */
import {buildTown,hashSeed} from './gen.js';
import {createWorld} from './sim.js';
import {computeEffectsForYear} from './policy.js';

const $=id=>document.getElementById(id),query=new URLSearchParams(location.search);
const safeNumber=(value,fallback,min,max)=>{const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;};
const lat=safeNumber(query.get('lat'),29.7286,-85,85),lng=safeNumber(query.get('lng'),-95.4746,-180,180);
const origin={lat,lng},count=Math.round(safeNumber(query.get('people'),100,10,250));
const status=$('loading');
const notify=(type,detail={})=>window.dispatchEvent(new CustomEvent('hbl:world-feedback',{detail:{type,...detail}}));
let world,town,canvas,ctx,paused=false,speed=1,disposed=false,selected=null,panX=0,panZ=0,zoom=1,then=0,accum=0,frame=null,clock=0;
let activityDashboard=null,worker=null,weeklyPromise=null,experimentStatus='';
const planDefinitions={
  none:{id:'none',label:'No package',ids:[]},
  balanced:{id:'balanced',label:'Balanced',ids:['t_brt','h_lots','f_drainage','s_311']},
  'minimal-change':{id:'minimal-change',label:'Minimal change',ids:['t_bus','s_311','sb_filing']},
  'most-popular':{id:'most-popular',label:'Most popular',ids:['t_brt','h_vouchers','f_drainage','sb_payroll']},
};
const trail=new Map();
function applyPlan(){
  const id=$('policy').value,def=planDefinitions[id]||planDefinitions.none,year=Number($('planYear')?.value)||3;
  const staged=computeEffectsForYear(def.ids,year),e=staged.effects;
  Object.assign(world,{parkCleanupBoost:e.parkCleanupBoost,restockBoost:e.restockBoost,hiringBoost:e.hiringBoost,
    voucherMonthly:e.voucherMonthly,groceryDelivery:e.groceryDelivery});
  world.speedMult=e.speedMult;
  world.policy={...world.policy,id,label:def.label,proposalIds:def.ids,floodMitigation:e.floodMitigation,floodedNow:world.policy?.floodedNow||0,displaced:world.policy?.displaced||0};
  $('policyNote').textContent=def.label+' · year '+year+' · transit ×'+e.speedMult.toFixed(2)+' · flood mitigation '+(e.floodMitigation*100).toFixed(0)+'% (illustrative local rules).';
  notify('policy',{label:'Plan configured',message:'The '+def.label+' mechanisms are active. Run a matched comparison before attributing outcomes to the plan.',metrics:[{label:'Transit multiplier',value:e.speedMult.toFixed(2)+'×'}]});
}
function storm(){
  const buildings=world.buildings.filter(b=>b.kind!=='park');
  const fraction=Math.max(0,Math.min(1,.24-(world.policy?.floodMitigation||0)));
  const ranked=[...buildings].sort((a,b)=>hashSeed(String(a.id)) - hashSeed(String(b.id)));
  const affected=new Set(ranked.slice(0,Math.round(buildings.length*fraction)).map(b=>b.index)),safe=world.buildings.filter(b=>b.kind==='home'&&!affected.has(b.index));
  let displaced=0;
  for(const b of world.buildings){b.state.flooded=affected.has(b.index);}
  for(const p of world.people){if(!affected.has(p.home))continue;p.today.homeFlooded=true;p.today.displaced=true;
    const home=safe.reduce((best,b)=>!best||Math.hypot(p.x-b.center[0],p.z-b.center[1])<Math.hypot(p.x-best.center[0],p.z-best.center[1])?b:best,null);
    if(!home)continue;displaced++;p.home=home.index;p.x=home.center[0];p.z=home.center[1];
    p.needs.energy=Math.max(0,p.needs.energy-12);p.needs.fun=Math.max(0,p.needs.fun-15);p.needs.social=Math.max(0,p.needs.social-10);
  }
  world.policy.floodedNow=affected.size;world.policy.displaced=displaced;
  world.log('Lite-mode storm: '+affected.size+' flooded buildings, '+displaced+' relocated fictional residents.','storm');
  notify('storm',{label:'Lite storm result',message:'Simplified local storm intervention (not the 3D hazard rule). These values come from the live Canvas2D town.',metrics:[
    {label:'Flooded buildings',value:String(affected.size)},{label:'Relocated residents',value:String(displaced)}]});
}
function snapshot(){
  const s=world.summary(),mood=Math.max(0,Math.min(100,s.mood));
  $('mood').style.width=mood.toFixed(1)+'%';$('moodN').textContent=mood.toFixed(0)+' / 100';
  $('moodMeter')?.setAttribute('aria-valuenow',String(Math.round(mood)));
  $('clock').textContent='Day '+(world.day()+1)+' · '+String(Math.floor(world.minuteOfDay()/60)).padStart(2,'0')+':'+String(world.minuteOfDay()%60).padStart(2,'0');
  const top=Object.entries(s.doing).sort((a,b)=>b[1]-a[1]).slice(0,4);
  $('counts').textContent=top.map(([name,n])=>n+' '+name).join(' · ');
  if(clock%55===0)notify('snapshot',{mode:'legacy',mood,clock:$('clock').textContent,activity:top.slice(0,2).map(([k,v])=>v+' '+k).join(' · ')});
}
function coords(){
  const pts=town.buildings.flatMap(b=>b.poly||[]);
  let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
  for(const p of pts){minX=Math.min(minX,p[0]);maxX=Math.max(maxX,p[0]);minZ=Math.min(minZ,p[1]);maxZ=Math.max(maxZ,p[1]);}
  const range=Math.max(50,maxX-minX,maxZ-minZ),cx=(minX+maxX)/2,cz=(minZ+maxZ)/2;
  const scale=Math.min(canvas.width,canvas.height)/range*.77*zoom;
  return{x:x=>canvas.width/2+(x-cx-panX)*scale,z:z=>canvas.height/2+(z-cz-panZ)*scale,
    reverse:(x,y)=>[cx+panX+(x-canvas.width/2)/scale,cz+panZ+(y-canvas.height/2)/scale],scale};
}
function paint(){
  if(!world||!canvas||disposed)return;
  const dpr=Math.min(2,window.devicePixelRatio||1),w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
  ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#12252f';ctx.fillRect(0,0,canvas.width,canvas.height);
  const c=coords();
  ctx.strokeStyle='#30444c';ctx.lineWidth=1;
  for(let i=0;i<12;i++){const x=canvas.width*i/12,y=canvas.height*i/12;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);ctx.stroke();ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);ctx.stroke();}
  const colors={home:'#e0c6a2',work:'#87a6bd',food:'#e8946d',shop:'#dcac5a',school:'#a98fc7',park:'#639e72'};
  for(const b of town.buildings){
    ctx.beginPath();
    const poly=b.poly?.length>=3?b.poly:[[b.center[0]-8,b.center[1]-8],[b.center[0]+8,b.center[1]-8],[b.center[0]+8,b.center[1]+8],[b.center[0]-8,b.center[1]+8]];
    poly.forEach(([x,z],i)=>{if(!i)ctx.moveTo(c.x(x),c.z(z));else ctx.lineTo(c.x(x),c.z(z));});ctx.closePath();
    ctx.fillStyle=b.state?.flooded?'#467cda':colors[b.kind]??'#adbec0';ctx.fill();
    ctx.strokeStyle=b.state?.flooded?'#a2cfff':'#0c1920';ctx.lineWidth=b.state?.flooded?3:1;ctx.stroke();
  }
  for(const p of world.people){
    const x=c.x(p.x),y=c.z(p.z);if(!Number.isFinite(x+y))continue;
    if(clock%10===0){const a=trail.get(p.id)||[];a.push([x,y]);if(a.length>10)a.shift();trail.set(p.id,a);}
    if(p.mode==='moving'){
      const a=trail.get(p.id)||[];ctx.strokeStyle='#92d9b579';ctx.lineWidth=1.2;ctx.beginPath();a.forEach(([tx,ty],i)=>i?ctx.lineTo(tx,ty):ctx.moveTo(tx,ty));ctx.stroke();
    }
    ctx.fillStyle=p.id===selected?.id?'#ffe283':p.mode==='moving'?'#69e4a1':'#edf1dd';ctx.beginPath();ctx.arc(x,y,p.id===selected?.id?5:3,0,Math.PI*2);ctx.fill();
  }
  ctx.fillStyle='#edf2ed';ctx.font=Math.round(12*dpr)+'px system-ui';
  ctx.fillText('Canvas2D · '+town.people.length+' fictional residents · sourced geometry if available',10*dpr,20*dpr);
  if(selected){ctx.fillStyle='#ffe69a';ctx.fillText(selected.name+' · '+selected.doing,10*dpr,37*dpr);}
}
function draw(now){
  if(disposed)return;
  const dt=then?Math.max(0,Math.min(100,now-then)):0;then=now;
  if(!paused && world){accum+=dt*speed/1000;const mins=Math.min(6,Math.floor(accum));if(mins>0){world.step(mins);accum-=mins;} }
  clock++;if(clock%10===0)snapshot();
  paint();frame=requestAnimationFrame(draw);
}
function choosePerson(x,y){
  const c=coords(),[wx,wz]=c.reverse(x,y),maxRadius=18/c.scale;
  const p=world.people.reduce((best,row)=>!best||Math.hypot(row.x-wx,row.z-wz)<Math.hypot(best.x-wx,best.z-wz)?row:best,null);
  if(!p||Math.hypot(p.x-wx,p.z-wz)>maxRadius)return;
  selected=p;notify('resident',{label:'Resident selected',message:p.name+' · '+p.doing+' · current needs and position are from the live local simulation.',metrics:[
    {label:'Energy',value:p.needs.energy.toFixed(0)},{label:'Social',value:p.needs.social.toFixed(0)},{label:'Fun',value:p.needs.fun.toFixed(0)}]});
}
function runWeek(){
  if(weeklyPromise)return weeklyPromise;
  const message=$('cycleStatus');message.textContent='Comparing matched weeks on CPU…';
  $('runCycleBtn').disabled=true;
  const ids=planDefinitions[$('policy').value]?.ids??planDefinitions.balanced.ids;
  weeklyPromise=new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./cycle.worker.js',import.meta.url),{type:'module'});
    const timeout=setTimeout(()=>{worker.terminate();reject(new Error('Weekly worker timed out'));},90000);
    worker.onmessage=e=>{
      if(e.data.type==='progress'){message.textContent=e.data.stage+'…';return;}
      clearTimeout(timeout);worker.terminate();
      if(e.data.type==='error'){reject(new Error(e.data.error));return;}
      const r=e.data.result,d=Number(r?.avg?.withPlan)-Number(r?.avg?.noPlan);
      message.textContent='Matched weekly comparison complete';
      const metrics=[{label:'No plan',value:Number(r.avg.noPlan).toFixed(1)},{label:'With plan',value:Number(r.avg.withPlan).toFixed(1)},
        {label:'Well-being difference',value:(d>0?'+':'')+d.toFixed(1)},{label:'Better off',value:String(r.improved)},{label:'Worse off',value:String(r.worse)}];
      notify('cycle',{label:'Paired weekly comparison',message:'Two copies of the same synthetic starting town and seed, with and without the chosen plan.',metrics,resultId:'cyclePanel'});
      $('cyclePanel').style.display='block';
      $('cyclePanel').replaceChildren();
      const summary=document.createElement('p');summary.textContent='Week result · '+metrics.map(row=>row.label+': '+row.value).join(' · ');$('cyclePanel').append(summary);
      resolve(r);
    };
    worker.onerror=e=>{clearTimeout(timeout);worker.terminate();reject(new Error(e.message||'Worker failed'));};
    worker.postMessage({type:'run',payload:{origin,area:townArea,maxPeople:town.people.length,
      proposalIds:ids,label:planDefinitions[$('policy').value]?.label??'Balanced',year:Number($('planYear')?.value)||3,days:7}});
  }).catch(error=>{message.textContent='Weekly comparison unavailable: '+error.message;notify('error',{label:'Weekly comparison failed',message:error.message});throw error;})
    .finally(()=>{weeklyPromise=null;$('runCycleBtn').disabled=false;});
  return weeklyPromise;
}
let townArea={source:'none',origin,buildings:[],roads:[],pois:[]};
async function init(){
  document.body.classList.add('canvas-lite-active');
  status.textContent='Preparing low-fidelity Canvas2D World…';
  try{
    const timeout=AbortSignal.timeout(9000);
    const response=await fetch('/api/area?'+new URLSearchParams({lat,lng,radiusM:400,core:1}),{signal:timeout});
    if(response.ok)townArea=await response.json();
  }catch{status.textContent='Map provider unavailable; starting a procedural fictional neighborhood.';}
  town=buildTown(origin,townArea,{maxPeople:count});
  world=createWorld(town,{recordHistory:true});
  canvas=document.createElement('canvas');canvas.id='canvas-lite-world';canvas.setAttribute('aria-label','Playable low fidelity top-down city');canvas.style.cssText='width:100%;height:100%;display:block;touch-action:none';$('view').append(canvas);
  ctx=canvas.getContext('2d');if(!ctx){status.textContent='Canvas2D is unavailable. Try another browser.';return;}
  $('source').textContent='Canvas2D low fidelity · '+(townArea.source==='osm'?'OSM building footprints, fictional residents':'Procedural fictional neighborhood')+' · same legacy City activity rules as the classic World, simplified graphics.';
  $('policy').value='none';
  $('planLoadingStatus').textContent='Local plan presets available in low-fidelity mode; remote catalog not required.';
  $('simulationModelMetadata').textContent ||= 'Synthetic legacy parameters available; loaded independently of GPU.';
  const seed=town.seedKey+'|exp-v1';$('experimentSeed').textContent=seed;$('experimentSeedInput').value=seed;
  $('policy').addEventListener('change',applyPlan);
  $('planYear').addEventListener('input',()=>{$('planYearN').textContent='Year '+$('planYear').value;applyPlan();});
  $('stormBtn').addEventListener('click',storm);
  $('runCycleBtn').addEventListener('click',()=>runWeek().catch(()=>{}));
  $('runExperimentBtn').addEventListener('click',()=>{const a=document.createElement('a');a.href='/world/city-lab.html';a.click();});
  $('experimentStatus').textContent='The 120-month CPU City laboratory opens separately. It uses a different monthly engine.';
  $('demoBtn').addEventListener('click',()=>demo().catch(()=>{}));
  for(const button of $('speeds').querySelectorAll('button'))button.addEventListener('click',()=>{
    const value=Number(button.dataset.s);paused=value===0;speed=value||speed;
    for(const other of $('speeds').querySelectorAll('button'))other.classList.toggle('on',other===button);
    notify('playback',{paused,speed});
  });
  let start=null;canvas.addEventListener('pointerdown',e=>{start={x:e.clientX,y:e.clientY,panX,panZ};canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointerup',e=>{if(!start)return;const dx=e.clientX-start.x,dy=e.clientY-start.y,c=coords();
    if(Math.hypot(dx,dy)<8)choosePerson((e.clientX-canvas.getBoundingClientRect().left)*canvas.width/canvas.clientWidth,(e.clientY-canvas.getBoundingClientRect().top)*canvas.height/canvas.clientHeight);
    else{panX=start.panX-dx/c.scale;panZ=start.panZ-dy/c.scale;}start=null;});
  canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.5,Math.min(7,zoom*(e.deltaY<0?1.15:.87)));},{passive:false});
  $('activity-dashboard-button').addEventListener('click',async()=>{
    if(!activityDashboard){const {mountActivityDashboard}=await import('./activity-dashboard.js');activityDashboard=mountActivityDashboard({container:document.body,
      getSnapshot:()=>world.getActivitySnapshot(),getHistory:q=>world.getActivityHistory(q),subscribe:callback=>world.subscribeActivity(callback),
      onSelectPerson:id=>{const p=world.people.find(p=>String(p.id)===String(id));if(p)selected=p;} });}
    if(activityDashboard.isOpen())activityDashboard.close();else activityDashboard.open();
  });
  window.hblGuidedActions={week:runWeek,storm,tenYear:()=>{location.href='/world/city-lab.html';},resident:()=>{
    selected=world.people[0];notify('resident',{label:'Resident selected',message:selected.name+' · '+selected.doing+'. Current synthetic resident, not a real person.'});
  }};
  window.hblWorldActivity={getSnapshot:()=>world.getActivitySnapshot(),getHistory:q=>world.getActivityHistory(q),selectPerson:id=>{selected=world.people.find(p=>String(p.id)===String(id))??selected;}};
  window.hblWorldStartup={readyMs:performance.now(),mode:'canvas2d',origin};
  window.dispatchEvent(new CustomEvent('hbl:world-ready'));
  status.style.display='none';applyPlan();snapshot();frame=requestAnimationFrame(draw);
  if(query.get('autoplay')==='1')setTimeout(()=>demo().catch(()=>{}),100);
}
async function demo(){
  $('demoBar').hidden=false;$('demoStep').textContent='CANVAS2D / TWO FUTURES';
  $('demoCaption').textContent='Watch synthetic residents move while the CPU compares a week with and without the selected plan.';
  $('demoPause').hidden=true;$('demoSkip').hidden=true;
  $('demoStop').textContent='Close';
  $('demoStop').onclick=()=>{$('demoBar').hidden=true;};
  try{const r=await runWeek();const d=Number(r.avg.withPlan)-Number(r.avg.noPlan);
    $('demoStep').textContent='MATCHED WEEK COMPLETE';
    $('demoCaption').textContent='No plan '+r.avg.noPlan.toFixed(1)+' vs plan '+r.avg.withPlan.toFixed(1)+' ('+(d>=0?'+':'')+d.toFixed(1)+'). '+r.improved+' better off, '+r.worse+' worse off in this synthetic model.';
  }catch(error){$('demoCaption').textContent='The comparison could not run: '+error.message;}
}
window.addEventListener('pagehide',()=>{disposed=true;cancelAnimationFrame(frame);activityDashboard?.destroy();}, {once:true});
init().catch(error=>{status.textContent='Canvas2D could not start: '+error.message;});
