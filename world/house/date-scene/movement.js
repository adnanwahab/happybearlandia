import {dateMovementRequest} from './presentation.js';
/** Serializes model requests. Held keys wait for the actual current walk, avoiding
 * repeated stale-position retargets that restart it before a clock interval. */
export function createDateMovementController({getState,onMove,onError=()=>{},intervalMs=180}={}){
 const held=new Set();let inFlight=false,lastSent=-Infinity,blocked=false,queued=null,destroyed=false;
 async function send(request,now){if(destroyed||!request)return false;if(inFlight){queued=request;return false;}inFlight=true;lastSent=now;try{const result=await onMove(request);if(result===null||result===false||result?.accepted===false)throw Error(result?.reason??result?.error??'Movement was not accepted. Check the date status.');blocked=false;onError(null);return true;}catch(error){blocked=true;onError(error.message??String(error));return false;}finally{inFlight=false;const next=queued;queued=null;if(next&&!destroyed)void send(next,now+intervalMs);}}
 return {press(key){if(!held.has(key)){blocked=false;lastSent=-Infinity;}held.add(key);},release(key){held.delete(key);if(!held.size)blocked=false;},clear(){held.clear();queued=null;},
 tick(now,azimuth){const state=getState();if(destroyed||blocked||inFlight||!held.size||now-lastSent<intervalMs||state.readOnly||!state.date||state.date.localMovement&&state.date.attendance?.available!==false)return;const dx=Number(held.has('d'))-Number(held.has('a')),dz=Number(held.has('s'))-Number(held.has('w'));const request=dateMovementRequest(state,dx*Math.cos(azimuth)+dz*Math.sin(azimuth),-dx*Math.sin(azimuth)+dz*Math.cos(azimuth));if(request&&Math.hypot(request.x,request.z)<=400)void send(request,now);},
 moveTo(request,now=0){blocked=false;return send(request,now);},getDebug:()=>({held:[...held],inFlight,blocked,queued:!!queued}),destroy(){destroyed=true;held.clear();queued=null;}};
}
export function visibleDateHit(hit){let node=hit?.object;if(!node)return false;while(node){if(node.visible===false)return false;node=node.parent;}return true;}
export function solidDateBuildingHit(hit){const material=hit?.object?.material;return visibleDateHit(hit)&&!!hit.object.userData.building&&!(material?.transparent&&material.opacity<.6);}
/** Table staging is cosmetic. An actual player walk wins through subsequent
 * inspector refreshes, including the temporary disappearance of mystery staging. */
export function createDateStagingGuard(){let context=null,released=false;return{update({date,readOnly=false}={}){const key=date?String(date.id)+':'+String(date.globalPlace?.id??date.venue?.id??''):null;if(key!==context){context=key;released=false;}if(!date)return false;if(readOnly)return true;if(date.localMovement||date.presentationPosture==='standing')released=true;else if(date.presentationPosture==='seated')released=false;else if((date.movementSequence??0)>0)released=true;return !released;},release(){released=true;},getDebug:()=>({context,released}),reset(){context=null;released=false;}};}
