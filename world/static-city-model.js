import {buildTown} from './gen.js';
export function cityViewURL(input,reason='requested'){
 const url=new URL(input,'http://hbl.local');url.pathname='/world/static-city.html';url.searchParams.set('renderer','webgl2');url.searchParams.set('viewReason',['requested','unavailable','initialization'].includes(reason)?reason:'initialization');return url.pathname+url.search+url.hash;
}
export function gameViewURL(input){const url=new URL(input,'http://hbl.local');url.pathname='/world';url.searchParams.delete('renderer');url.searchParams.delete('viewReason');return url.pathname+url.search+url.hash;}
export function cityViewOrigin(params){const value=(key,fallback,min,max)=>{const raw=params.get(key),n=raw==null||!raw.trim()?fallback:Number(raw);if(!Number.isFinite(n)||n<min||n>max)throw Error('Choose valid latitude and longitude.');return n;};return{lat:value('lat',29.7286,-85,85),lng:value('lng',-95.4746,-180,180)};}
/** Geometry extraction only. No simulation, workers, resident records or clock. */
export function createStaticCity(origin,area={source:'none'},{savedGeometry=false}={}){
 const town=buildTown(origin,area,{maxPeople:0,savedGeometry});
 const buildings=town.buildings.filter(b=>b.poly?.length>=3&&b.poly.every(p=>Array.isArray(p)&&p.length>=2&&p.every(Number.isFinite))).map(b=>({id:String(b.id),name:b.name,kind:b.kind,poly:b.poly.map(p=>[...p]),height:Math.max(.3,Math.min(640,Number.isFinite(b.height)?b.height:6)),area:b.area,center:[...b.center]}));
 if(!buildings.length)throw Error('No usable building geometry was supplied.');
 let minX=Infinity,minZ=Infinity,maxX=-Infinity,maxZ=-Infinity;for(const b of buildings)for(const[x,z]of b.poly){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);}
 return{origin:{...origin},source:town.source,attribution:town.attribution??null,seedKey:town.seedKey,buildings,roads:town.roads.filter(r=>r.pts?.length>=2&&r.pts.every(p=>p.every(Number.isFinite))).map(r=>({kind:r.kind,pts:r.pts.map(p=>[...p])})),bounds:{minX,minZ,maxX,maxZ}};
}
