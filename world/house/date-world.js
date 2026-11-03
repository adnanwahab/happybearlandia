import {createDatePlace,validateDatePlace} from './date-place.js';
import {projector} from '../gen.js';

export const DATE_WORLD_RADIUS_M = 400;
const finite = Number.isFinite;
export function dateWorldKey(place) {
  return finite(place?.lat)&&finite(place?.lng)&&Math.abs(place.lat)<=90&&Math.abs(place.lng)<=180
    ? `${place.lat.toFixed(6)},${place.lng.toFixed(6)}` : null;
}

/** Accept only provider-preserved OSM identities. Missing IDs remain map points,
 * never latitude/longitude-derived OSM identities. */
export function normalizeDateWorldPlace(input) {
  let id=input?.id;
  if(typeof id==='string'&&/^(node|way|relation)[/:][1-9]\d*$/.test(id))id='osm:'+id.replace('/',':');
  if(!/^osm:(node|way|relation):[1-9]\d{0,19}$/.test(String(id))){
    const type=input?.osmType??input?.type,osmId=input?.osmId??input?.id;
    if(['node','way','relation'].includes(type)&&/^[1-9]\d{0,19}$/.test(String(osmId)))id=`osm:${type}:${osmId}`;
    else return null;
  }
  try{return createDatePlace({...input,id,lng:input.lng??input.lon,osmTags:input.osmTags??input.tags});}catch{return null;}
}
export function dateWorldVenuePlace(input){try{validateDatePlace(input);return createDatePlace(input);}catch{return null;}}
export function mergeDateWorldPlaces(world, result) {
  const proj=projector(world.origin),verified=[];
  for(const input of (Array.isArray(result?.places)?result.places:[]).slice(0,200)){
    const place=dateWorldVenuePlace(input);if(!place)continue;const [x,z]=proj.toXZ(place.lat,place.lng);if(Math.hypot(x,z)>world.radiusM)continue;
    verified.push({...place,x,z,interactive:true,markerId:place.id});
  }
  const byId=new Map();for(const place of [world.selectedPlace,...verified,...world.places]){const key=place.id??place.markerId;if(!byId.has(key))byId.set(key,place);}
  return {...world,places:[...byId.values()].slice(0,160),nearby:{status:'ready',verifiedCount:verified.length,attribution:result.attribution??null,warnings:(result.warnings??[]).slice(0,8)}};
}

const validRing = pts => Array.isArray(pts)&&pts.length>=3&&pts.every(p=>Array.isArray(p)&&p.length>=2&&p.every(finite));
/** Environment only: never calls population generation or changes the home world.
 * Coordinates are east/south metres relative to the chosen place. */
export function buildDateWorld(place, area = {}, {participantIds=[]}={}) {
  const key=dateWorldKey(place);
  if(!key)throw new Error('Date world needs a geographic place.');
  const origin={lat:place.lat,lng:place.lng},proj=projector(origin),radiusM=DATE_WORLD_RADIUS_M;
  const project=p=>proj.toXZ(p[0],p[1]);
  const nearby=p=>Math.hypot(...p)<=radiusM+100;
  const mapped=area.source==='osm';
  const buildings=(mapped?area.buildings??[]:[]).filter(b=>validRing(b.pts)&&b.pts.length<=512).map(b=>{
    const polygon=b.pts.map(project),center=polygon.reduce((a,p)=>[a[0]+p[0]/polygon.length,a[1]+p[1]/polygon.length],[0,0]);
    return {id:String(b.id),name:b.name??'',kind:b.kind??'building',polygon,center,height:Math.max(3,Math.min(90,(Number(b.levels)||2)*3.2)),source:'osm'};
  }).filter(b=>nearby(b.center)).sort((a,b)=>Math.hypot(...a.center)-Math.hypot(...b.center)).slice(0,350);
  const roads=(mapped?area.roads??[]:[]).filter(r=>Array.isArray(r.pts)&&r.pts.length>=2&&r.pts.every(p=>Array.isArray(p)&&p.length>=2&&p.every(finite))).map((r,i)=>({id:String(r.id??`road:${i}`),kind:r.kind??'road',points:r.pts.slice(0,200).map(project),source:'osm'})).filter(r=>r.points.some(nearby)).slice(0,350);
  const places=(mapped?area.pois??[]:[]).filter(p=>finite(p.lat)&&finite(p.lng)).map((p,i)=>{
    const canonical=normalizeDateWorldPlace(p),[x,z]=proj.toXZ(p.lat,p.lng);
    return {...(canonical??p),id:canonical?.id??null,markerId:canonical?.id??`map-point:${i}`,name:p.name??p.kind??'Mapped place',x,z,source:'osm',interactive:!!canonical};
  }).filter(p=>Math.hypot(p.x,p.z)<=radiusM).slice(0,159);
  const canonical=normalizeDateWorldPlace(place),selected={...(canonical??place),id:canonical?.id??place.id??null,markerId:'selected:'+key,x:0,z:0,interactive:!!canonical};
  const duplicate=places.findIndex(p=>canonical&&p.id===canonical.id);if(duplicate>=0)places.splice(duplicate,1);places.unshift(selected);
  return {schemaVersion:'date-world.v1',key,origin,radiusM,participantIds:[...new Set(participantIds.map(String))].slice(0,2),selectedPlace:selected,buildings,roads,places,
    limits:{buildings:350,roads:350,places:160,roadSegments:2000,buildingVertices:512},source:mapped?'osm':'unavailable',status:mapped?'ready':'fallback',provenance:{source:mapped?'osm':'unavailable',attribution:area.attribution??(mapped?'© OpenStreetMap contributors':null),cacheStatus:area.cacheStatus??null,stale:!!area.stale,fetchedAt:area.fetchedAt??null,error:area.error??(!mapped?'Neighborhood map unavailable; showing the chosen location only.':null)}};
}
/** One selected/active place at a time. Superseded results never publish, including
 * fetch implementations that ignore AbortSignal. UI owns load lifecycle. */
export function createDateWorldLoader({fetchImpl=globalThis.fetch,onUpdate=()=>{},timeoutMs=15000,nearby=true}={}) {
  let controller=null,generation=0,current=null,destroyed=false;
  function cancel(){generation++;controller?.abort();controller=null;}
  return {get current(){return current;},cancel,
    async load(place,{participantIds=[],signal}={}) {
      if(destroyed)throw new Error('Date world loader destroyed.');
      if(!dateWorldKey(place))throw new Error('Choose a place with latitude and longitude.');
      cancel();const version=generation;controller=new AbortController();const own=controller;
      const abort=()=>own.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
      const live=()=>!destroyed&&version===generation&&!own.signal.aborted;
      const publish=world=>{if(live()){current=world;onUpdate(world);}};
      publish({...buildDateWorld(place,{}, {participantIds}),status:'loading',nearby:{status:nearby?'loading':'disabled'}});
      async function json(url){let timer,abortWait;const requestController=new AbortController(),abortRequest=()=>requestController.abort();own.signal.addEventListener('abort',abortRequest,{once:true});if(own.signal.aborted)abortRequest();try{
        const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{requestController.abort();reject(new Error('Neighborhood request timed out.'));},timeoutMs);});
        const aborted=new Promise((_,reject)=>{abortWait=()=>reject(new Error('Neighborhood request canceled.'));own.signal.addEventListener('abort',abortWait,{once:true});if(own.signal.aborted)abortWait();});
        const request=(async()=>{const response=await fetchImpl(url,{signal:requestController.signal});if(!response.ok)throw Error(`Neighborhood HTTP ${response.status}`);return response.json();})();
        return await Promise.race([request,deadline,aborted]);
      }finally{clearTimeout(timer);own.signal.removeEventListener('abort',abortRequest);if(abortWait)own.signal.removeEventListener('abort',abortWait);}}
      let enrichment=null,enrichmentError=null;
      const query=new URLSearchParams({lat:String(place.lat),lng:String(place.lng),radiusM:'400'});
      // Independent progressive requests: map painting never waits for discovery.
      const mapRequest=json(`/api/area?${query}&core=1`);
      const discovery=nearby?json(`/api/date-places/nearby?${new URLSearchParams({lat:String(place.lat),lng:String(place.lng),radius:'400'})}`).then(result=>{if(!live())return;enrichment=result;publish(mergeDateWorldPlaces(current,result));}).catch(error=>{if(!live())return;enrichmentError=error.message;publish({...current,nearby:{status:'unavailable',error:error.message}});}):Promise.resolve();
      try{
        let area;try{area=await mapRequest;}catch(error){area={source:'none',error:error.message};}
        if(!live())return null;
        let world={...buildDateWorld(place,area,{participantIds}),nearby:{status:nearby?'loading':'disabled'}};
        if(enrichment)world=mergeDateWorldPlaces(world,enrichment);else if(enrichmentError)world.nearby={status:'unavailable',error:enrichmentError};
        publish(world);await discovery;return live()?current:null;
      }finally{signal?.removeEventListener('abort',abort);}
    },destroy(){destroyed=true;cancel();current=null;}};
}

/** Only arrived active dates request geography. Planner selections and recorded
 * replays never load unless loadRecordedContext is explicitly true. Live
 * traveling destinations remain unloaded; replay context is present-day only. */
export function dateWorldRequest(value={}) {
  const date=value.date??value.active??value.dates?.active;
  if(!date)return null;
  if(value.readOnly){if(value.loadRecordedContext!==true)return null;}
  else if(['planning','traveling','traveling-home'].includes(date.phase)||date.travel)return null;
  const place=date.globalPlace??date.place??date.venue?.globalPlace??date.venue;
  return dateWorldKey(place)?{place,participantIds:date.personIds??[]}:null;
}
