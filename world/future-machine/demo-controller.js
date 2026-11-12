import { CINEMATIC_BUDGET } from '../../shared/media/pipeline.js';
/** Presentation clock only. Every displayed month remains an authoritative City frame. */
export function createDemoController({onMonth,onHighlight,onExplain,onState,now=()=>performance.now(),schedule=fn=>setInterval(fn,50),unschedule=clearInterval,duration=50000}={}) {
  if (!Number.isFinite(duration) || duration <= 0 || duration > CINEMATIC_BUDGET.durationMs) throw Error('Cinematic duration budget exceeded');
  let timer=null,start=0,elapsed=0,paused=false,status='idle',first=null,highlighted=false;
  const captions=()=>elapsed<4000?'Same city. Same seed. Two identical starting worlds.':first&&elapsed>=10000&&elapsed<16000?`First physical divergence · Month ${first.month}. Recorded housing change; inspect WHY.`:elapsed<38000?'One housing decision. Watch recorded monthly construction and outcomes diverge.':elapsed<44000?'The highlighted structure is a recorded City change. Compare the measured outcomes.':'Click a glowing structure or outcome to inspect WHY, then explore any month.';
  function emit(){onState?.({status,paused,elapsedMs:elapsed,durationMs:duration,caption:captions()});}
  function stop(){if(timer!==null)unschedule(timer);timer=null;status='idle';paused=false;emit();}
  function tick(){if(status!=='playing'||paused)return;elapsed=Math.min(duration,now()-start);const reveal=first?.month;const month=elapsed<4000?0:reveal!=null&&elapsed<10000?Math.floor((elapsed-4000)/6000*reveal):reveal!=null&&elapsed<16000?reveal:reveal!=null?Math.min(120,reveal+Math.floor((elapsed-16000)/22000*(120-reveal))):Math.min(120,Math.floor((elapsed-4000)/34000*120));onMonth?.(month);
    if(first&&!highlighted&&month>=first.month){highlighted=true;onHighlight?.(first);}
    if(elapsed>=44000)onExplain?.();
    if(elapsed>=duration){if(timer!==null)unschedule(timer);timer=null;status='complete';}emit();}
  return {start(stopPoint){if(status==='disposed')return;stop();first=stopPoint;highlighted=false;elapsed=0;start=now();status='playing';onMonth?.(0);emit();timer=schedule(tick);},skip(){if(status!=='playing')return;if(timer!==null)unschedule(timer);timer=null;elapsed=duration;paused=false;onMonth?.(120);status='complete';emit();},replay(){if(status==='disposed')return;this.start(first);},togglePause(){if(status!=='playing')return;paused=!paused;if(!paused)start=now()-elapsed;emit();},stop,getState:()=>({status,paused,elapsedMs:elapsed}),dispose(){if(timer!==null)unschedule(timer);timer=null;status='disposed';}};
}
