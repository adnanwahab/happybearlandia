const KEY='hbl-reality-latest-comparison-v1',CHANNEL='hbl-reality-comparisons-v1';
export function publishRealityComparison(replay,worldContext={}){
 if(replay?.status!=='completed'||!['city','population'].includes(replay.engine))return;
 const side=value=>({snapshot:structuredClone(value.snapshot??value.state),metrics:structuredClone(value.metrics)});
 const packet={schemaVersion:'reality-comparison-channel.v1',comparison:{id:replay.runId,runId:replay.runId,engine:replay.engine,seed:replay.seed,baseline:side(replay.baseline),treatment:side(replay.treatment),worldContext:structuredClone(worldContext)}};
 const raw=JSON.stringify(packet);if(new TextEncoder().encode(raw).length>2000000)return{published:false,reason:'Paired snapshot exceeds the 2 MB cross-view display budget'};
 let persisted=false;try{localStorage.setItem(KEY,raw);persisted=true;}catch{}
 if(typeof BroadcastChannel!=='undefined'){const channel=new BroadcastChannel(CHANNEL);channel.postMessage(packet);channel.close();}return{published:true,persisted};
}
export function subscribeRealityComparisons(callback){
 let channel=null;const accept=packet=>{if(packet?.schemaVersion==='reality-comparison-channel.v1'&&packet.comparison?.baseline&&packet.comparison?.treatment)callback(packet.comparison);};
 try{const raw=localStorage.getItem(KEY);if(raw&&raw.length<=2000000)accept(JSON.parse(raw));}catch{}
 const storage=event=>{if(event.key===KEY&&event.newValue&&event.newValue.length<=2000000)try{accept(JSON.parse(event.newValue));}catch{}};globalThis.addEventListener?.('storage',storage);
 if(typeof BroadcastChannel!=='undefined'){channel=new BroadcastChannel(CHANNEL);channel.onmessage=event=>accept(event.data);}
 return()=>{channel?.close();globalThis.removeEventListener?.('storage',storage);};
}
