import {createCityFromArea} from '../city/seed.js';
import {describeRealityInitial} from '../reality/geography.js';
/** Past geometry is evidence; no historical household, rent or job observations
 * are inferred from a mapping snapshot. This always starts a fresh model. */
export function historicalRealityInitial(snapshot,{seed=42,households=30}={}){
 if(!snapshot||typeof snapshot.id!=='string'||snapshot.id.length>128||!snapshot.provenance?.historicalGeometry||!Number.isFinite(Date.parse(snapshot.date))||!Number.isFinite(snapshot.origin?.lat)||Math.abs(snapshot.origin.lat)>85||!Number.isFinite(snapshot.origin?.lng)||Math.abs(snapshot.origin.lng)>180||!Array.isArray(snapshot.features)||snapshot.features.length>2000)throw new Error('A bounded dated historical geometry snapshot with source provenance is required');
 if(new TextEncoder().encode(JSON.stringify(snapshot)).length>1000000)throw new Error('Historical snapshot exceeds 1 MB; select a smaller radius');
 if(typeof snapshot.date!=='string'||!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/.test(snapshot.date)||new Date(snapshot.date).toISOString().slice(0,10)!==snapshot.date.slice(0,10))throw new Error('Historical snapshot requires a valid ISO UTC date');
 const date=new Date(snapshot.date),radius=snapshot.radiusM??200;
 if(date<new Date('2012-09-12T06:56:00Z')||date>new Date())throw new Error('Historical snapshot date is outside supported attic coverage');
 if(!Number.isFinite(radius)||radius<100||radius>400)throw new Error('Historical radius must be 100–400 metres');
 if(!Number.isInteger(seed)||seed<0||seed>4294967295||!Number.isInteger(households)||households<1||households>2000)throw new Error('Historical model seed or household count is outside supported bounds');
 const selected=snapshot.features.filter(f=>f.kind==='building'&&f.geometry?.type==='Polygon'&&Array.isArray(f.geometry.coordinates?.[0])&&f.geometry.coordinates[0].length>=4).slice(0,80);
 if(!selected.length)throw new Error('This snapshot contains no supported historical building polygons. No present-day fallback is used.');
 for(const feature of selected){const ring=feature.geometry.coordinates[0],first=ring[0],last=ring.at(-1);if(!Array.isArray(first)||!Array.isArray(last)||first[0]!==last[0]||first[1]!==last[1])throw new Error('Historical building polygons must be closed');}
 const buildings=selected.map(f=>({id:f.id,pts:f.geometry.coordinates[0].map(p=>{if(!Array.isArray(p)||p.length<2||!p.slice(0,2).every(Number.isFinite)||Math.abs(p[0])>180||Math.abs(p[1])>90)throw new Error('Invalid historical coordinates');return[p[1],p[0]];}),levels:Math.max(1,Math.min(100,Number(f.tags?.['building:levels'])||1)),name:f.tags?.name}));
 const initial=createCityFromArea({source:'osm',origin:snapshot.origin,radiusM:radius,buildings},{seed,households});
 for(let i=0;i<selected.length;i++)initial.buildings[i].geometry=structuredClone(selected[i].geometry);
 initial.provenance.temporalSnapshot={id:snapshot.id,date:snapshot.date,source:'OpenStreetMap historical mapping snapshot',attribution:snapshot.attribution};
 initial.provenance.datasetVersion='historical-geometry:'+snapshot.id;
 initial.provenance.assumptions.push('Historical geometry records mapping presence, not a verified construction date. Economic conditions, households and institutions are fresh synthetic assumptions, not historical observations.','At most80 building Polygon footprints are sampled in source order. Multipolygon buildings and other feature types are not converted into model buildings.');
 const geography=describeRealityInitial(initial,{...snapshot.origin,note:`Historical mapping ${snapshot.date} · ${selected.length} mapped footprints · ${households} synthetic households. Past rents, jobs and population are not observed.`});
 geography.worldContext.provenance.temporalSnapshot=initial.provenance.temporalSnapshot;return geography;
}
