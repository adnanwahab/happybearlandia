/** Pure geographic projection for the historical preview; never touches live agents. */
export function previewProjection(bounds,width=620,height=420) {
  const c=Math.cos((bounds.north+bounds.south)/2*Math.PI/180),dx=(bounds.east-bounds.west)*c,dy=bounds.north-bounds.south;
  if(!(dx>0&&dy>0))throw Error('Historical map requires positive geographic bounds.');
  const scale=Math.min((width-32)/dx,(height-32)/dy),ox=(width-dx*scale)/2,oy=(height-dy*scale)/2;
  return ([lng,lat])=>[ox+(lng-bounds.west)*c*scale,oy+(bounds.north-lat)*scale];
}
export function previewPaths(geometry,project) {
  if(!geometry)return [];
  const path=(points,close=false)=>points.map((p,i)=>`${i?'L':'M'}${project(p).map(v=>v.toFixed(2)).join(',')}`).join(' ')+(close?' Z':'');
  if(geometry.type==='Polygon')return [geometry.coordinates.map(r=>path(r,true)).join(' ')];
  if(geometry.type==='MultiPolygon')return geometry.coordinates.map(p=>p.map(r=>path(r,true)).join(' '));
  if(geometry.type==='LineString')return [path(geometry.coordinates)];
  return [];
}
export function featureChangeMap(diff) {return new Map((diff?.events||[]).map(e=>[e.featureId,e.type]));}
export function drawTemporalPreview(svg,snapshot,{diff=null,onSelect=()=>{},selectedId=null}={}) {
  const doc=svg.ownerDocument,ns='http://www.w3.org/2000/svg',project=previewProjection(snapshot.bounds),changes=featureChangeMap(diff);
  svg.replaceChildren();svg.setAttribute('viewBox','0 0 620 420');svg.setAttribute('aria-label',`Historical mapped geometry for ${snapshot.date.slice(0,10)}. Select an object for its evidence.`);
  const make=(tag,attrs)=>{const node=doc.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))node.setAttribute(k,v);return node;};
  svg.append(make('rect',{width:620,height:420,fill:'#112c32'}));
  const features=[...snapshot.features];
  const present=new Set(features.map(f=>f.id));
  for(const event of diff?.events||[]){const counterpart=event.after||event.before;if(counterpart&&!present.has(counterpart.id)){features.push(counterpart);present.add(counterpart.id);}}
  features.sort((a,b)=>Number(a.geometry?.type==='Point')-Number(b.geometry?.type==='Point'));
  for(const feature of features) {
    if(!feature.geometry)continue;
    const change=changes.get(feature.id),color=change==='mapping-added'?'#65e6b0':change==='mapping-removed'?'#fb8594':change==='mapping-changed'?'#ffc66b':feature.kind==='road'?'#82a4ae':feature.kind==='park'?'#477e59':feature.kind==='building'?'#adc3bd':'#d7b9ef';
    const group=make('g',{'data-feature-id':feature.id,tabindex:0,role:'button','aria-label':`${feature.tags.name||feature.kind} · ${feature.id}${change?' · '+change:''}`,class:'temporal-map-object'});
    const title=make('title',{});title.textContent=`${feature.tags.name||feature.kind} · ${feature.id}`;group.append(title);
    if(feature.geometry.type==='Point'){const [cx,cy]=project(feature.geometry.coordinates);group.append(make('circle',{cx,cy,r:3.8,fill:color,stroke:feature.id===selectedId?'#fff':'#162d31','stroke-width':feature.id===selectedId?3:1}));}
    else for(const d of previewPaths(feature.geometry,project))group.append(make('path',{d,fill:feature.geometry.type==='LineString'?'none':color,stroke:feature.id===selectedId?'#fff':color,'stroke-width':feature.id===selectedId?3:feature.kind==='road'?2:0.7,'fill-rule':'evenodd',opacity:change==='mapping-removed'?0.5:0.85}));
    group.addEventListener('click',()=>onSelect(feature));group.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(feature);}});svg.append(group);
  }
}
export function historicalForkRecord(snapshot,policy='') {
  if(!snapshot?.id||!Array.isArray(snapshot.features)||!snapshot.provenance?.historicalGeometry)throw Error('A real historical snapshot is required.');
  return {schemaVersion:'reality-historical.v1',id:snapshot.id,snapshot,policy,createdAt:new Date().toISOString(),interpretation:'Historical mapped geometry as baseline; policy outcomes are synthetic and are not observed history.'};
}
/** API stores chronological differences; the panel explains the pinned→selected direction. */
export function directionalPreviewDiff(diff,pinnedId,selectedId) {
  if(diff.before===pinnedId&&diff.after===selectedId)return diff;
  if(diff.after!==pinnedId||diff.before!==selectedId)throw Error('Comparison does not match the selected historical snapshots.');
  const events=diff.events.map(event=>({...event,type:event.type==='mapping-added'?'mapping-removed':event.type==='mapping-removed'?'mapping-added':event.type,before:event.after,after:event.before}));
  return {...diff,before:pinnedId,after:selectedId,events,counts:Object.fromEntries(['mapping-added','mapping-removed','mapping-changed'].map(type=>[type,events.filter(event=>event.type===type).length])),interpretation:'Mapping differences from pinned baseline to selected date. This direction may run backwards in time; it does not imply physical construction or demolition.'};
}
export function saveHistoricalFork(storage,record,{maxBytes=1000000,maxRecords=8}={}) {
  const raw=JSON.stringify(record);
  if(new TextEncoder().encode(raw).length>maxBytes)throw Error('Historical fork exceeds 1 MB. Load a smaller radius before opening a policy fork.');
  const prefix='hbl-reality-history:',key=prefix+record.id,keys=[];
  for(let i=0;i<storage.length;i++){const candidate=storage.key(i);if(candidate?.startsWith(prefix))keys.push(candidate);}
  if(!storage.getItem(key)&&keys.length>=maxRecords)throw Error(`This browser already holds ${maxRecords} historical forks. Remove an old saved historical fork before adding another.`);
  storage.setItem(key,raw);return key;
}
