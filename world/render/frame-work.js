/** Keep unchanged fixed simulation minutes, yielding between minutes when the
 * presentation budget is exhausted. Backlog stays with the caller, never lost. */
export function advanceFrameMinutes(pending,step,{now=()=>performance.now(),budgetMs=4,maxSteps=8}={}){
 const available=Math.max(0,Math.floor(pending));
 const start=now();let advanced=0;
 while(advanced<available&&advanced<maxSteps){
  if(advanced&&now()-start>=budgetMs)break;
  step(1);advanced++;
 }
 return advanced;
}
/** Presentation-only interpolation between two observed clock values. Delays
 * visual motion by one worker interval; never extrapolates beyond model state. */
export function createObservedClock(){
 let minute=null,from=0,received=0,duration=0,paused=false,run=null;
 return{sample(next,now,{paused:stopped=false,runId=null}={}){
  if(!Number.isFinite(next)||!Number.isFinite(now))return next;
  if(minute===null||runId!==run||next<minute){minute=from=next;duration=0;received=now;run=runId;}
  else if(next!==minute){from=this.value(now);duration=Math.max(16,Math.min(1000,now-received));minute=next;received=now;}
  paused=stopped;if(paused){from=minute;duration=0;}
  return this.value(now);
 },value(now){return duration&&!paused?from+(minute-from)*Math.min(1,Math.max(0,(now-received)/duration)):minute;}};
}
