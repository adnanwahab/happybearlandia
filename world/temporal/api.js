import { fileURLToPath } from 'node:url';
import { snapshotInput,snapshotFrom,snapshotDiff,normalizeHistory,fail } from './model.js';
import { createTemporalStore } from './store.js';
const ALLOWED = ['https://overpass-api.de/api/interpreter','https://lz4.overpass-api.de/api/interpreter','https://z.overpass-api.de/api/interpreter','https://overpass.private.coffee/api/interpreter'];
const MAX_BYTES=10*1024*1024;
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export function createTemporalCityHandler({dbPath=fileURLToPath(new URL('../../.data/city-history.sqlite',import.meta.url)),fetchImpl=fetch,endpoints=ALLOWED.slice(0,2),now=()=>new Date()}={}) {
  if(!Array.isArray(endpoints) || !endpoints.length || endpoints.some(e=>!ALLOWED.includes(e))) throw new Error('Historical Overpass endpoint must be explicitly allowlisted.');
  const store=createTemporalStore(dbPath),pending=new Map();
  async function fetchJSON(url,options={}) {
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),18000);
    try {
      const response=await fetchImpl(url,{...options,signal:controller.signal,headers:{Accept:'application/json',...options.headers}});
      if(!response.ok) fail(`Historical source returned HTTP ${response.status}.`,502);
      if(Number(response.headers.get('content-length'))>MAX_BYTES) fail('Historical response exceeds 10 MB; reduce the area.',422);
      const reader=response.body?.getReader(); let size=0; const chunks=[];
      if(!reader) fail('Historical source returned no body.',502);
      try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BYTES){await reader.cancel();fail('Historical response exceeds 10 MB; reduce the area.',422);}chunks.push(value);}}finally{reader.releaseLock();}
      const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
      try{return JSON.parse(new TextDecoder().decode(bytes));}catch{fail('Historical source returned invalid JSON.',502);}
    } finally {clearTimeout(timer);}
  }
  async function snapshot(input) {
    const key=JSON.stringify(input),cached=store.findSnapshot(key);if(cached)return cached;
    if(pending.has(key))return pending.get(key);
    const run=(async()=>{
      const b=input.bounds,box=[b.south,b.west,b.north,b.east].join(',');
      const query=`[out:json][timeout:15][date:"${input.date.replace(/\.\d{3}Z$/,'Z')}"];(way["building"](${box});relation["building"](${box});way["leisure"~"^(park|playground)$"](${box});relation["leisure"~"^(park|playground)$"](${box});way["highway"](${box});node["shop"](${box});node["amenity"](${box}););out meta geom;`;
      let lastError;
      for(const endpoint of endpoints.slice(0,2)) {
        try {const data=await fetchJSON(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({data:query}).toString()});const result=snapshotFrom(data,input,endpoint);store.saveSnapshot(result,key);return result;}
        catch(error){lastError=error;if(error.status===422)throw error;}
      }
      fail(`Historical snapshot unavailable; no current-map fallback was used. ${lastError?.message||''}`,502);
    })();pending.set(key,run);try{return await run;}finally{pending.delete(key);}
  }
  const handle=async request=>{
    try {
      if(request.method!=='GET')return json({error:'Only GET is supported.'},405);
      const url=new URL(request.url),route=url.pathname.replace(/\/$/,'').split('/').at(-1),p=url.searchParams;
      if(route==='snapshot') {
        if(p.has('id')){const found=store.getSnapshot(p.get('id'));return found?json(found):json({error:'Snapshot not found.'},404);}
        return json(await snapshot(snapshotInput(p,now())));
      }
      if(route==='diff') {
        const before=store.getSnapshot(p.get('before')),after=store.getSnapshot(p.get('after'));
        if(!before||!after)fail('Both snapshot IDs must exist in this local cache.',404);
        const diff=snapshotDiff(before,after);store.saveDiff(diff);return json(diff);
      }
      if(route==='feature') {
        const type=p.get('type'),id=p.get('id');if(!['node','way','relation'].includes(type)||!/^\d{1,17}$/.test(id||''))fail('Feature requires type=node|way|relation and a numeric id.');
        const cached=store.getHistory(`${type[0]}${id}`),age=cached?now().getTime()-Date.parse(cached.provenance?.fetchedAt):Infinity;if(cached&&Number.isFinite(age)&&age>=0&&age<6*60*60*1000)return json(cached);
        const data=await fetchJSON(`https://api.openstreetmap.org/api/0.6/${type}/${id}/history.json`);
        if(!Array.isArray(data.elements))fail('Invalid OSM history response.',502);
        const result=normalizeHistory(data.elements,type,id);if(!result.versions.length)fail('OSM object history not found.',404);result.provenance.fetchedAt=now().toISOString();result.provenance.cacheMaxAgeSeconds=21600;store.saveHistory(result);return json(result);
      }
      return json({error:'Unknown history route.'},404);
    }catch(error){return json({error:error.message||'Historical data unavailable.'},error.status||502);}
  };
  handle.close=()=>store.close();return handle;
}
