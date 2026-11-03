/** Bounded actual whole-city simulation. Never changes birthdays, balances or clock offsets directly. */
export async function fastForwardHouse({runtime,householdId,minutes,signal,onProgress}={}){
 const snapshot=runtime?.getSnapshot?.(),step=snapshot?.runtime?.stepMinutes,population=snapshot?.config?.population??snapshot?.population;
 if(typeof runtime?.observeHousehold!=='function'||!Number.isInteger(step)||step<1)throw Error('This saved city cannot fast-forward.');
 if(!Number.isInteger(minutes)||minutes<step||minutes>525600||minutes%step)throw Error('Choose at most one 365-day year (525,600 minutes) aligned with this saved city’s fixed step.');
 if(!Number.isFinite(population)||population<1||minutes/step*population>20000000)throw Error('This advance exceeds the 20 million agent-step limit. Choose a shorter interval.');
 const chunk=Math.floor(Math.min(1440,20000000/population*step)/step)*step;if(chunk<step)throw Error('This population is too large for a bounded advance.');
 runtime.pause();let elapsedMinutes=0,result,work=0,budgetLimited=false;
 const report=status=>onProgress?.({elapsedMinutes,totalMinutes:minutes,status,minute:runtime.getSnapshot().minute});report('observing');
 while(elapsedMinutes<minutes&&!signal?.aborted){const current=runtime.getSnapshot(),count=current.config?.population??current.population,remaining=minutes-elapsedMinutes,available=Math.floor((20000000-work)/count)*step,runMinutes=Math.min(chunk,remaining,available);if(runMinutes<step){budgetLimited=true;break;}const offset=elapsedMinutes;result=await runtime.observeHousehold({householdId,minutes:runMinutes,signal,onProgress:p=>onProgress?.({...p,elapsedMinutes:offset+p.elapsedMinutes,totalMinutes:minutes})});elapsedMinutes+=result.elapsedMinutes;const after=runtime.getSnapshot();work+=result.elapsedMinutes/step*Math.max(count,after.config?.population??after.population);if(result.status!=='completed')break;await new Promise(resolve=>setTimeout(resolve,0));}
 const status=elapsedMinutes===minutes?'completed':budgetLimited?'budget-limited':'cancelled';report(status);return{...result,status,elapsedMinutes,minute:runtime.getSnapshot().minute};
}
