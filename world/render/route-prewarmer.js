/** One stationary origin per background job; no simulation or checkpoint writes.
 * A single timer prevents stale queued source work after restore/mode changes. */
export function createRoutePrewarmer({getSource,isActive=()=>true,now=()=>performance.now(),schedule=(fn,delay)=>setTimeout(fn,delay),cancel=id=>clearTimeout(id),budgetMs=4}={}){
 let timer=null,disposed=false,cursor=0,source=null,identity=null,lastMinute=null,jobs=0,maxJobMs=0;
 function pump(){timer=null;if(disposed)return;const world=getSource();if(!isActive()||!world?.warmRouteSource){timer=schedule(pump,250);return;}
  const runId=world.getActivityIdentity?.().runId??world;if(world!==source||runId!==identity||world.t<lastMinute){cursor=0;source=world;identity=runId;}lastMinute=world.t;
  const start=now(),people=world.people??[];let scanned=0;
  while(scanned<Math.min(people.length,64)&&now()-start<budgetMs){const person=people[cursor++%people.length];scanned++;if(person.mode==='moving'||!Number.isFinite(person.x)||!Number.isFinite(person.z))continue;world.warmRouteSource(person);jobs++;break;}
  maxJobMs=Math.max(maxJobMs,now()-start);timer=schedule(pump,8);
 }
 return{start(){if(!disposed&&timer===null)timer=schedule(pump,0);},getStats:()=>({jobs,maxJobMs,cursor}),dispose(){disposed=true;if(timer!==null)cancel(timer);timer=null;source=null;}};
}
