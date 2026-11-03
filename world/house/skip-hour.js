/** Advance the complete saved population on its existing clock, not a display offset. */
export async function skipHouseHour({runtime,householdId,signal,onProgress}={}){
 const snapshot=runtime?.getSnapshot?.(),step=snapshot?.runtime?.stepMinutes;if(typeof runtime?.observeHousehold!=='function')throw Error('The saved simulation cannot advance a household hour.');if(!Number.isInteger(step)||step<1||60%step!==0)throw Error('This saved fixed step cannot represent exactly one hour.');const wasPaused=snapshot.runtime.paused;
 try{return await runtime.observeHousehold({householdId,minutes:60,signal,onProgress});}
 finally{if(!wasPaused&&!signal?.aborted)runtime.resume();}
}
