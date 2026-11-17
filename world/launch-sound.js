/** Decorative audio only. It observes current authority and never advances it. */
export function advanceFootstep(previous,sample,now){
 const valid=sample?.controlled&&!sample.paused&&sample.walking&&Number.isFinite(sample.x)&&Number.isFinite(sample.z)&&Number.isFinite(now);
 if(!valid)return{state:null,step:false};
 const next={id:sample.id,runId:sample.runId,x:sample.x,z:sample.z,distance:0,lastAt:now};
 if(!previous||previous.id!==next.id||previous.runId!==next.runId)return{state:next,step:false};
 const distance=Math.hypot(next.x-previous.x,next.z-previous.z);
 if(distance>20)return{state:next,step:false}; // restore/teleport is not a footstep
 next.distance=previous.distance+distance;next.lastAt=previous.lastAt;
 const step=next.distance>=.65&&now-next.lastAt>=250;
 if(step){next.distance=0;next.lastAt=now;}
 return{state:next,step};
}
function currentFootstep(win){
 const commands=win.hblPersonCommands,state=commands?.getState?.(),actor=commands?.getActor?.();
 const frame=win.hblWorldTileSource?.getFrame?.(),person=frame?.people?.find(p=>String(p.id)===String(actor?.id));
 return{controlled:Boolean(state?.controlled),paused:win.hblSimulationPlayback?.getState?.().paused??true,id:actor?.id,runId:frame?.mode==='living'?String(frame.runId).replace(/:[^:]*$/,''):frame?.runId,x:person?.x,z:person?.z,walking:person?.travelMode==='walk'&&person?.mode==='moving'||person?.mode==='walk'&&person?.trip?.remainingMinutes>0};
}
export function mountWorldSound({container=document.getElementById('launch-playback'),win=window,getStep=()=>currentFootstep(win),onChange=()=>{}}={}){
 if(!container)return null;
 const button=container.ownerDocument.createElement('button');button.type='button';button.textContent='Sound off';button.setAttribute('aria-label','Enable game sound');button.setAttribute('aria-pressed','false');button.dataset.worldSound='';button.title='Quiet ambient, clicks and observed walking footsteps. Off by default.';container.append(button);
 const Audio=win.AudioContext??win.webkitAudioContext;
 let enabled=false,disposed=false,context=null,master=null,wind=null,timer=null,previous=null,controller=null,starting=false;
 if(!Audio){button.disabled=true;button.title='Web Audio is unavailable in this browser.';}
 function tone(frequency,duration,gain,type='sine'){
  if(!enabled||context?.state!=='running')return;
  const oscillator=context.createOscillator(),volume=context.createGain(),at=context.currentTime;oscillator.type=type;oscillator.frequency.setValueAtTime(frequency,at);volume.gain.setValueAtTime(.0001,at);volume.gain.exponentialRampToValueAtTime(gain,at+.005);volume.gain.exponentialRampToValueAtTime(.0001,at+duration);oscillator.connect(volume);volume.connect(master);oscillator.start(at);oscillator.stop(at+duration+.01);oscillator.onended=()=>{oscillator.disconnect();volume.disconnect();};
 }
 function disable(){
  enabled=false;win.clearInterval(timer);timer=null;previous=null;controller?.abort();controller=null;try{wind?.stop();wind?.disconnect();}catch{}wind=null;master?.disconnect();master=null;const old=context;context=null;if(old&&old.state!=='closed')void old.close().catch(()=>{});button.textContent='Sound off';button.setAttribute('aria-label','Enable game sound');button.setAttribute('aria-pressed','false');onChange(false);
 }
 async function enable(){
  if(disposed||enabled||starting||!Audio)return;starting=true;
  try{const next=new Audio();context=next;await next.resume();if(disposed||context!==next){if(next.state!=='closed')await next.close();return;}master=next.createGain();master.gain.value=.3;master.connect(next.destination);enabled=true;controller=new AbortController();
   const noise=next.createBuffer(1,next.sampleRate*2,next.sampleRate),data=noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.05;
   wind=next.createBufferSource();wind.buffer=noise;wind.loop=true;const filter=next.createBiquadFilter();filter.type='lowpass';filter.frequency.value=350;wind.connect(filter);filter.connect(master);wind.start();
   button.textContent='Sound on';button.setAttribute('aria-label','Disable game sound');button.setAttribute('aria-pressed','true');onChange(true);
   win.document.addEventListener('click',event=>{if(event.target.closest('button,a,summary')&&!event.target.closest('[data-world-sound]'))tone(620,.035,.035);},{signal:controller.signal});
   timer=win.setInterval(()=>{try{const result=advanceFootstep(previous,getStep(),win.performance.now());previous=result.state;if(result.step)tone(110,.055,.1,'triangle');}catch{previous=null;}},150);
   tone(440,.05,.035);
  }catch{disable();button.title='Audio could not start. Click to try again.';}finally{starting=false;}
 }
 const click=()=>enabled?disable():void enable();button.addEventListener('click',click);
 const visibility=()=>{if(win.document.hidden)disable();};win.document.addEventListener('visibilitychange',visibility);
 const api={enable,disable,get enabled(){return enabled;},getState:()=>({enabled,contextState:context?.state??'closed',timerActive:timer!==null}),dispose(){if(disposed)return;disposed=true;disable();button.removeEventListener('click',click);win.document.removeEventListener('visibilitychange',visibility);win.removeEventListener('pagehide',api.dispose);button.remove();}};
 win.addEventListener('pagehide',api.dispose,{once:true});return api;
}
/** Compatibility with the shell-owned sound pill; no duplicate control. */
export function createWorldAudio(win=window){
 const engine=mountWorldSound({container:win.document.createElement('div'),win,onChange:enabled=>{const button=win.document.querySelector('[data-launch=sound]');if(button){button.textContent=enabled?'Sound on':'Sound off';button.setAttribute('aria-pressed',String(enabled));}}});
 win.hblWorldSound=engine;return engine;
}
if(typeof window!=='undefined'&&typeof document!=='undefined'&&!document.querySelector('[data-launch=sound]'))window.hblWorldSound=mountWorldSound();
