/** Version 1 encoded-asset budgets. These are engineering caps, not GPU/RAM estimates. */
export const MEDIA_BUDGETS = Object.freeze({animation: 4 * 1024 * 1024, audio: 2 * 1024 * 1024, total: 6 * 1024 * 1024});
export const CINEMATIC_BUDGET = Object.freeze({durationMs: 60000, active: 1});

/** One cache/acquisition boundary for animation and sound, including in-flight bytes. */
export function createMediaPipeline({fetchImpl=fetch, budgets=MEDIA_BUDGETS}={}) {
  const entries=new Map();let bytes=0,disposed=false;
  function load(id,kind,url) {
    if(disposed)return Promise.reject(Error('Media pipeline disposed'));
    if(!['animation','audio'].includes(kind))return Promise.reject(Error('Unknown media kind'));
    const prior=entries.get(id);
    if(prior)return prior.kind===kind&&prior.url===url?prior.promise:Promise.reject(Error('Conflicting media identity'));
    const entry={kind,url,bytes:0,controller:new AbortController()};
    entries.set(id,entry);
    entry.promise=(async()=>{
      try {
        const response=await fetchImpl(url,{signal:entry.controller.signal});
        if(!response.ok)throw Error(`Media HTTP ${response.status}`);
        const reserve=n=>{
          const kindBytes=[...entries.values()].filter(e=>e.kind===kind).reduce((sum,e)=>sum+e.bytes,0);
          if(entry.bytes+n>budgets[kind]||kindBytes+n>budgets[kind]||bytes+n>budgets.total)throw Error(`Media ${kind} byte budget exceeded`);
          entry.bytes+=n;bytes+=n;
        };
        const declared=Number(response.headers.get('content-length'));
        if(declared>budgets[kind]||declared>budgets.total){await response.body?.cancel();throw Error(`Media ${kind} byte budget exceeded`);}
        const reader=response.body?.getReader();entry.reader=reader;
        if(!reader)throw Error('Streaming media response required');
        const chunks=[];
        try {while(true){const {done,value}=await reader.read();if(done)break;if(disposed)throw Error('Media pipeline disposed');reserve(value.byteLength);chunks.push(value);}}
        catch(error){await reader.cancel().catch(()=>{});throw error;}
        if(disposed)throw Error('Media pipeline disposed');
        const data=new Uint8Array(entry.bytes);let offset=0;
        for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.byteLength;}
        return data.buffer;
      } catch(error) {bytes-=entry.bytes;entries.delete(id);throw error;}
    })();
    return entry.promise;
  }
  return {load,stats:()=>({version:1,bytes,assets:entries.size,budgets:{...budgets}}),dispose(){disposed=true;for(const e of entries.values()){e.controller.abort();void e.reader?.cancel().catch(()=>{});e.bytes=0;}entries.clear();bytes=0;}};
}

/** Reject nonembedded dependencies before GLTFLoader can fetch unbudgeted assets. */
export function validateEmbeddedGLB(buffer) {
  const view=new DataView(buffer);
  if(view.byteLength<20||view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==view.byteLength||view.getUint32(16,true)!==0x4e4f534a)throw Error('Expected GLB v2');
  const length=view.getUint32(12,true);
  const json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,length)));
  if([...(json.buffers||[]),...(json.images||[])].some(item=>item.uri))throw Error('GLB must embed all media');
  return buffer;
}

/** Bound decoded animation work independently of compressed file size. */
export function validateAnimationClips(clips) {
  if (!Array.isArray(clips) || clips.length > 32) throw Error('Animation clip budget exceeded');
  let tracks=0,keys=0;
  for (const clip of clips) {
    if (!Number.isFinite(clip.duration) || clip.duration < 0 || clip.duration > 120) throw Error('Animation duration budget exceeded');
    for (const track of clip.tracks) { tracks++; keys+=track.times.length; }
  }
  if (tracks > 512 || keys > 200000) throw Error('Animation track/key budget exceeded');
  return clips;
}
