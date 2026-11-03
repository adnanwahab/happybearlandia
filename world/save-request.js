/** Bound both the request and response body. A rejected save never means that
 * current in-memory progress may be discarded. */
export async function saveJSONRequest(url,options,{fetchImpl=fetch,timeoutMs=60000,timeoutMessage='Saving timed out. Keep this page open and try again.'}={}){
 const controller=new AbortController();let timer;
 const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error(timeoutMessage));},timeoutMs);});
 try{return await Promise.race([(async()=>{const response=await fetchImpl(url,{...options,signal:controller.signal});let value;try{value=await response.json();}catch(error){if(controller.signal.aborted)throw error;throw Error('The save service returned an unreadable response ('+response.status+').');}return{response,value};})(),deadline]);}finally{clearTimeout(timer);}
}
