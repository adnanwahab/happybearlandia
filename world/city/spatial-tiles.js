// Rendering adapter only. Never mutates CityState or derives interactions from mass.
export const TILE_VERSION='city-spatial-tiles.v1';
const zero=()=>({buildings:0,units:0,households:0,residents:0});
const add=(a,b)=>{for(const k of Object.keys(a))a[k]+=b[k];return a;};
const intersects=(a,b)=>a.minX<=b.maxX&&a.maxX>=b.minX&&a.minY<=b.maxY&&a.maxY>=b.minY;
export function indexCityTiles(state,{tileSize=250}={}) {
 if(!Number.isFinite(tileSize)||tileSize<=0)throw new Error('Positive tile size required');
 const tiles=new Map(),buildingTiles=new Map(),unitTiles=new Map();
 const tile=(key,x,y,schematic=false)=>{if(!tiles.has(key))tiles.set(key,{key,schematic,bounds:{minX:x,minY:y,maxX:x+tileSize,maxY:y+tileSize},summary:zero(),rows:[]});return tiles.get(key);};
 const districtTile=id=>{const i=Math.max(0,state.districts.findIndex(d=>d.id===id));return tile(`district:${id}`,i*tileSize,0,true);};
 // A local tangent plane preserves imported footprint positions; schematic rows
 // remain separate keys and are explicitly labeled even when drawn nearby.
 const first=state.buildings.find(b=>b.geometry?.type==='Polygon')?.geometry.coordinates?.[0]?.[0];
 const origin=Array.isArray(first)&&first.length>=2&&first.slice(0,2).every(Number.isFinite)?first:null;
 const project=p=>[(p[0]-origin[0])*111320*Math.cos(origin[1]*Math.PI/180),-(p[1]-origin[1])*110540];
 for(const b of state.buildings){const ring=b.geometry?.type==='Polygon'?b.geometry.coordinates?.[0]:null;
  const valid=origin&&ring?.length>=3&&ring.every(p=>Array.isArray(p)&&p.length>=2&&p.slice(0,2).every(Number.isFinite));
  let t;if(valid){const center=ring.reduce((a,p)=>[a[0]+p[0]/ring.length,a[1]+p[1]/ring.length],[0,0]);const [x,y]=project(center),ix=Math.floor(x/tileSize),iy=Math.floor(y/tileSize);t=tile(`${ix}:${iy}`,ix*tileSize,iy*tileSize);}else t=districtTile(b.districtId);
  t.rows.push(b);t.summary.buildings++;buildingTiles.set(b.id,t);
 }
 for(const u of state.units){const t=buildingTiles.get(u.buildingId)||districtTile(u.districtId);t.summary.units++;unitTiles.set(u.id,t);}
 for(const h of state.households){const t=unitTiles.get(h.unitId)||districtTile(h.districtId);t.summary.households++;t.summary.residents+=h.size;}
 const entries=[...tiles.values()];const totals=entries.reduce((a,t)=>add(a,t.summary),zero());
 const bounds=entries.length?{minX:Math.min(...entries.map(t=>t.bounds.minX)),minY:Math.min(...entries.map(t=>t.bounds.minY)),maxX:Math.max(...entries.map(t=>t.bounds.maxX)),maxY:Math.max(...entries.map(t=>t.bounds.maxY))}:{minX:0,minY:0,maxX:tileSize,maxY:tileSize};
 const summaries=entries.map(({rows,...t})=>Object.freeze({...t,summary:Object.freeze(t.summary),bounds:Object.freeze(t.bounds)}));
 return {version:TILE_VERSION,totals:Object.freeze(totals),tiles:summaries,bounds,
  provenance:{model:state.version,seed:state.seed,month:state.month,revision:state.revision,dataset:state.provenance?.datasetVersion,geometrySource:state.provenance?.geometrySource||'none',adapter:TILE_VERSION},
  async load(key,{signal}={}){const t=tiles.get(key);if(!t)throw new Error('Unknown tile');const shapes=[];
   for(let i=0;i<t.rows.length;i++){if(i%32===0){await new Promise(resolve=>setTimeout(resolve,0));if(signal?.aborted)throw new Error('Tile cancelled');}
    const b=t.rows[i];if(t.schematic){const columns=Math.max(1,Math.ceil(Math.sqrt(t.rows.length))),cell=tileSize/columns,col=i%columns,row=Math.floor(i/columns);shapes.push({id:b.id,points:[[t.bounds.minX+cell*(col+.15),t.bounds.minY+cell*(row+.15)],[t.bounds.minX+cell*(col+.85),t.bounds.minY+cell*(row+.15)],[t.bounds.minX+cell*(col+.85),t.bounds.minY+cell*(row+.85)],[t.bounds.minX+cell*(col+.15),t.bounds.minY+cell*(row+.85)]]});}else shapes.push({id:b.id,points:b.geometry.coordinates[0].map(project)});
   }return shapes;
  }};
}
export function createTileStream(source,{onChange=()=>{},load=source.load,maxTiles=6,concurrency=2}={}) {
 if(!Number.isInteger(maxTiles)||maxTiles<1||!Number.isInteger(concurrency)||concurrency<1)throw new Error('Positive integer tile and concurrency limits required');
 const records=new Map();let disposed=false,wanted=new Set(),active=0,summaryOnly=false;
 const snapshot=()=>({totals:source.totals,tiles:source.tiles.map(t=>({...t,status:records.get(t.key)?.status||'coarse',shapes:records.get(t.key)?.shapes||[]})),active,summaryOnly});
 const notify=()=>{if(!disposed)onChange(snapshot());};
 function pump(){if(disposed||summaryOnly)return;for(const r of records.values()){if(active>=concurrency)break;if(r.status!=='queued')continue;r.status='loading';active++;
  Promise.resolve().then(()=>load(r.key,{signal:r.controller.signal})).then(shapes=>{if(!disposed&&records.get(r.key)===r&&!r.controller.signal.aborted){r.shapes=shapes;r.status='ready';}},()=>{if(!disposed&&records.get(r.key)===r)r.status='error';}).finally(()=>{active--;pump();notify();});
 }notify();}
 return {getState:snapshot,update(view,{coarse=false,retry=false}={}){if(disposed)return;summaryOnly=coarse;
  const cx=(view.minX+view.maxX)/2,cy=(view.minY+view.maxY)/2;
  wanted=new Set(coarse?[]:source.tiles.filter(t=>intersects(t.bounds,view)).sort((a,b)=>((a.bounds.minX-cx)**2+(a.bounds.minY-cy)**2)-((b.bounds.minX-cx)**2+(b.bounds.minY-cy)**2)).slice(0,maxTiles).map(t=>t.key));
  for(const [key,r]of records)if(!wanted.has(key)||(retry&&r.status==='error')){r.controller.abort();records.delete(key);}
  for(const key of wanted)if(!records.has(key))records.set(key,{key,status:'queued',controller:new AbortController()});pump();notify();
 },dispose(){disposed=true;for(const r of records.values())r.controller.abort();records.clear();}};
}
