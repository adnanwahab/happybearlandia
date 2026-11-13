/** Bounded, cached OSM venue discovery. Not a complete business census. */
import {queryOverpass, OVERPASS_TIMEOUT_MS} from '../api.js';

export const HOUSTON_BAR_CATALOG_VERSION = 'houston-osm-bars.v1';
export const HOUSTON_BAR_BOUNDS = Object.freeze({south:29.52,west:-95.86,north:30.13,east:-95.02});
export const HOUSTON_BAR_QUERY = '[out:json][timeout:25];(nwr["amenity"~"^(bar|pub|nightclub)$"](29.52,-95.86,30.13,-95.02););out center tags;';

const finite=Number.isFinite;
const txt=(s,max=160)=>String(s??'').replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,max);
const json=(obj,status=200)=>Response.json(obj,{status,headers:{'Cache-Control':'public,max-age=300','X-Content-Type-Options':'nosniff'}});

export function normalizeHoustonBarElements(elements) {
  if(!Array.isArray(elements))throw new TypeError('Expected Overpass elements');
  const seen=new Set(),venues=[];
  for(const row of elements.slice(0,10000)) {
    if(!['node','way','relation'].includes(row?.type)||!Number.isSafeInteger(row.id)||row.id<0)continue;
    const tags=row.tags??{},kind=tags.amenity;
    if(!['bar','pub','nightclub'].includes(kind))continue;
    const lat=Number(row.type==='node'?row.lat:row.center?.lat),lng=Number(row.type==='node'?row.lon:row.center?.lon);
    if(!finite(lat)||!finite(lng)||lat<29.52||lat>30.13||lng< -95.86||lng> -95.02)continue;
    const id=row.type+':'+row.id;if(seen.has(id))continue;seen.add(id);
    const address=[tags['addr:housenumber'],tags['addr:street']].filter(Boolean).map(x=>txt(x,90)).join(' ');
    const neighborhood=txt(tags['addr:suburb']||tags['addr:neighbourhood']||tags['addr:city']||'',80);
    venues.push({
      id,osmType:row.type,osmId:row.id,kind,
      name:txt(tags.name,120)||'Unnamed mapped '+kind,
      lat,lng,address,neighborhood,
      levels:finite(Number(tags['building:levels']))?Math.max(1,Math.min(80,Number(tags['building:levels']))):null,
      sourceUrl:'https://www.openstreetmap.org/'+row.type+'/'+row.id,
    });
  }
  return venues.sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id)).slice(0,3000);
}

export function createHoustonBarCatalogHandler({lookup=(query)=>queryOverpass(query,Math.max(OVERPASS_TIMEOUT_MS,14000)),now=Date.now,ttlMs=6*60*60*1000}={}) {
  let cache=null,age=-Infinity,inflight=null;
  return async request=>{
    if(request.method!=='GET')return json({error:'Use GET for venue discovery'},405);
    const time=now();
    if(cache&&time-age<ttlMs)return json({...cache,cacheStatus:'fresh'});
    if(!inflight)inflight=(async()=>{
      const result=await lookup(HOUSTON_BAR_QUERY);
      const venues=normalizeHoustonBarElements(result?.elements);
      const item={schemaVersion:HOUSTON_BAR_CATALOG_VERSION,source:'OpenStreetMap via Overpass',bounds:HOUSTON_BAR_BOUNDS,venueCount:venues.length,venues,
        fetchedAt:new Date(now()).toISOString(),
        coverage:'OSM-tagged bars, pubs and nightclubs in a bounded Houston-area box; not a complete list of businesses or a guarantee of current operation. Exterior footprints must be looked up separately.'};
      cache=item;age=now();return item;
    })().finally(()=>{inflight=null;});
    try{return json({...await inflight,cacheStatus:'fresh'});}
    catch(error){
      if(cache)return json({...cache,cacheStatus:'stale',warning:'Map providers unavailable; showing last successful snapshot.'});
      return json({schemaVersion:HOUSTON_BAR_CATALOG_VERSION,venues:[],venueCount:0,error:'Live OSM venue discovery is temporarily unavailable. Retry later; no fictional businesses were substituted.',coverage:'Overpass could not be reached.',source:'OpenStreetMap via Overpass'},503);
    }
  };
}
