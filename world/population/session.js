/** Local, same-origin collaboration. Event replay is descriptive, never approval. */
export const SESSION_VERSION='hbl.decision-session.v1';
const TYPES=new Set(['presenter','viewpoint','annotation','question','experiment-task','proposal','world-edit','simulation','milestone','final-choice']);
const text=(value,max)=>{if(typeof value!=='string'||!value.trim()||value.length>max)throw new TypeError(`Text must contain 1–${max} characters.`);return value.trim();};
const clone=value=>JSON.parse(JSON.stringify(value));
const vector=value=>Array.isArray(value)&&value.length===3&&value.every(n=>Number.isFinite(n)&&Math.abs(n)<=1e7);
function payloadFor(type,payload={}) {
 if(type==='presenter')return {};
 if(type==='viewpoint'){if(!vector(payload.position)||!vector(payload.target))throw new TypeError('Invalid camera viewpoint.');return{position:[...payload.position],target:[...payload.target]};}
 if(type==='annotation')return{target:{kind:text(payload.target?.kind,40),id:text(payload.target?.id,160)},text:text(payload.text,1000)};
 if(type==='question')return{text:text(payload.text,1000)};
 if(type==='experiment-task')return{questionId:text(payload.questionId,160),text:text(payload.text,1000),status:'proposed',approvalRequired:true};
 return{label:text(payload.label,200),...(payload.reference?{reference:text(payload.reference,200)}:{})};
}
function checkedEvent(value){
 if(!value||!TYPES.has(value.type)||!Number.isFinite(value.at)||value.at<0)throw new TypeError('Invalid session event.');
 return{id:text(value.id,160),actor:text(value.actor,80),at:value.at,type:value.type,payload:payloadFor(value.type,value.payload)};
}
export function createDecisionSession({sessionId='living-city',clientId,channelFactory,maxEvents=500,now=()=>Date.now()}={}) {
 sessionId=text(sessionId,80);clientId=text(clientId||`tab-${globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2)}`,80);
 const limit=Math.min(500,Math.max(10,Math.floor(Number(maxEvents)||500))),listeners=new Set();
 let events=[],sequence=0,following=false,destroyed=false,dropped=0,lastViewAt=-Infinity,lastViewSignature=null;
 const factory=channelFactory===null?null:channelFactory||((name)=>typeof BroadcastChannel!=='undefined'?new BroadcastChannel(name):null);
 const channel=factory?.(`hbl-session-v1:${sessionId}`)||null;
 const state=()=>{
  const presenter=events.filter(e=>e.type==='presenter').at(-1)?.actor||null;
  const views=new Map();for(const e of events)if(e.type==='viewpoint')views.set(e.actor,{actor:e.actor,at:e.at,viewpoint:e.payload});
  return{version:SESSION_VERSION,sessionId,clientId,scope:channel?'Local same-origin tabs only':'This tab only',following,presenter,events:clone(events),dropped,
   participants:clone([...views.values()]),annotations:clone(events.filter(e=>e.type==='annotation')),questions:clone(events.filter(e=>e.type==='question')),tasks:clone(events.filter(e=>e.type==='experiment-task'))};
 };
 const notify=(event,live=false)=>{for(const listener of listeners)try{listener({state:state(),event:event?clone(event):null,live});}catch{}};
 function merge(incoming,{live=false}={}){
  const ids=new Set(events.map(e=>e.id)),fresh=[];for(const e of incoming){if(ids.has(e.id))continue;ids.add(e.id);fresh.push(e);if(e.actor===clientId&&e.id.startsWith(`${clientId}:`)){const n=Number(e.id.slice(clientId.length+1));if(Number.isSafeInteger(n))sequence=Math.max(sequence,n);}}
  if(!fresh.length)return;
  events=[...events,...fresh].sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));
  if(events.length>limit){dropped+=events.length-limit;events=events.slice(-limit);}
  // Retained log has an additional byte bound, even when every event is large.
  while(events.length&&JSON.stringify(events).length>512*1024){events.shift();dropped++;}
  for(const e of fresh)notify(e,live);
 }
 function post(message){try{channel?.postMessage({version:SESSION_VERSION,sessionId,sender:clientId,...message});}catch{}}
 function record(type,payload={}){
  if(destroyed)throw new Error('Session is closed.');
  const event=checkedEvent({id:`${clientId}:${++sequence}`,actor:clientId,at:now(),type,payload});
  merge([event],{live:true});post({kind:'event',event});return clone(event);
 }
 const onMessage=({data})=>{
  if(destroyed||data?.version!==SESSION_VERSION||data.sessionId!==sessionId||data.sender===clientId)return;
  try{
   if(data.kind==='hello')post({kind:'sync',events});
   else if(data.kind==='event')merge([checkedEvent(data.event)],{live:true});
   else if(data.kind==='sync'&&Array.isArray(data.events)&&data.events.length<=500)merge(data.events.map(checkedEvent));
  }catch{/* Invalid peer data never alters existing state. */}
 };
 channel?.addEventListener?.('message',onMessage);if(channel&&!channel.addEventListener)channel.onmessage=onMessage;
 post({kind:'hello'});
 return{
  record,getState:state,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
  setFollowing(value){following=Boolean(value);notify();},present(){return record('presenter');},
  publishViewpoint(viewpoint){const checked=payloadFor('viewpoint',viewpoint),signature=JSON.stringify(checked);if(signature===lastViewSignature||now()-lastViewAt<250)return null;const event=record('viewpoint',checked);lastViewAt=event.at;lastViewSignature=signature;return event;},
  annotate(target,body){return record('annotation',{target,text:body});},ask(body){return record('question',{text:body});},
  createExperimentTask(questionId){const question=events.find(e=>e.id===questionId&&e.type==='question');if(!question)throw new Error('Question is outside the retained log.');return record('experiment-task',{questionId,text:question.payload.text});},
  export(){return{version:SESSION_VERSION,sessionId,exportedAt:now(),scope:'local-same-origin',dropped,events:clone(events)};},
  import(data){if(typeof data==='string'){if(data.length>600*1024)throw new Error('Session file exceeds 600 KiB.');data=JSON.parse(data);}if(!data||data.version!==SESSION_VERSION||!Array.isArray(data.events)||data.events.length>500||JSON.stringify(data).length>600*1024)throw new TypeError('Invalid or oversized session replay.');const validated=data.events.map(checkedEvent);merge(validated);return state();},
  replay(onEvent){const snapshot=clone(events);for(const e of snapshot)onEvent?.(e);return snapshot;},
  destroy(){if(destroyed)return;destroyed=true;channel?.removeEventListener?.('message',onMessage);channel?.close?.();listeners.clear();}
 };
}
