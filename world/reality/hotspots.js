/** Recorded divergence, not potential scope. Every field has an explicit
 * analyst comparison scale; magnitude=max(abs(delta/scale)), capped at one.
 * Directions are declared comparison rules, never a claim of total wellbeing.
 */
export const HOTSPOT_SCALES=Object.freeze({
 city:{buildings:{floors:[3,'floors',0]},units:{rent:[100,'USD/month',-1],quality:[.2,'quality index',1]},households:{income:[1000,'USD/month',1],savings:[1000,'USD stock',1],rentBurden:[.1,'income fraction',-1]},businesses:{revenue:[1000,'modeled USD/month',1],operatingCost:[1000,'modeled USD/month',-1],commercialRent:[100,'USD/month',-1],viability:[1000,'model viability units',1]},districts:{resilience:[.1,'resilience index',1],accessibility:[.1,'access index',1]},links:{travelTime:[10,'modeled minutes',-1],flow:[100,'model flow units',0],capacity:[100,'model capacity units',0]}},
 population:{visibleAgents:{income:[12000,'USD/year',1],commuteMinutes:[10,'modeled minutes',-1],satisfaction:[.1,'modeled utility, not happiness',1],'needs.hunger':[10,'satisfaction points',1],'needs.energy':[10,'satisfaction points',1],'needs.fun':[10,'satisfaction points',1],'needs.social':[10,'satisfaction points',1]},households:{annualIncome:[12000,'USD/year',1],monthlyRent:[100,'USD/month',-1],savings:[1000,'USD stock',1],stress:[.1,'model stress index',-1]},buildingOccupancy:{count:[10,'synthetic people',0]},districts:{housingUnits:[100,'coarse housing-capacity units',0],jobs:[100,'coarse job-capacity units',0],congestion:[.2,'model congestion index',-1],transitCrowding:[.2,'model crowding index',-1],housingStress:[10,'stressed synthetic households',-1],movesIn:[10,'recorded household moves',0],movesOut:[10,'recorded household moves',0]}}
});
const rows=(s,key)=>Array.isArray(s?.[key])?s[key]:[];
const keyOf=row=>String(row.id??row.personId??row.buildingId);
const valueAt=(row,path)=>path.split('.').reduce((v,k)=>v?.[k],row);
const unwrap=s=>s?.snapshot??s?.state??s;
const finite=Number.isFinite;
export function computeRealityHotspots({baseline,current,engine='city',worldContext={},layout,limit=64}={}){
 if(!Number.isInteger(limit)||limit<1||limit>128)throw Error('Hotspot limit must be1–128');
 baseline=unwrap(baseline);current=unwrap(current);
 const groups=new Map(),unmapped=[],missing=new Set();let changedFields=0,unmappedFields=0;
 const mapped=new Map(),districts=new Map();
 const origin=worldContext.origin??current?.provenance?.origin??{},lat=origin.lat??0,lng=origin.lng??0;
 const project=([x,y])=>[(x-lng)*111320*Math.cos(lat*Math.PI/180),-(y-lat)*110540];
 for(const b of [...rows(worldContext,'buildings'),...rows(current,'buildings'),...rows(baseline,'buildings')]){
  let center=Array.isArray(b.center)&&b.center.every(finite)?b.center:null;
  const ring=b.geometry?.type==='Polygon'?b.geometry.coordinates?.[0]:null;
  if(!center&&Array.isArray(b.poly)&&b.poly.length>=3)center=b.poly.reduce((s,p)=>[s[0]+p[0]/b.poly.length,s[1]+p[1]/b.poly.length],[0,0]);
  if(!center&&ring?.length>=3){const poly=ring.map(project);center=poly.reduce((s,p)=>[s[0]+p[0]/poly.length,s[1]+p[1]/poly.length],[0,0]);}
  if(center?.every(finite)&&!mapped.has(String(b.id)))mapped.set(String(b.id),{x:center[0],z:center[1],y:finite(b.height)?b.height+.7:finite(b.floors)?b.floors*3.2+.7:.7,kind:'building',id:String(b.id),source:'supplied footprint or point anchor'});
 }
 for(const b of layout?.buildings??[])if(!b.syntheticLocation)mapped.set(String(b.id),{x:b.center[0],z:b.center[1],y:b.height+.7,kind:'building',id:String(b.id),source:'supplied footprint'});
 for(const d of [...rows(worldContext,'districts'),...rows(current,'districts')])if(finite(d.x)&&finite(d.z)&&!districts.has(String(d.id)))districts.set(String(d.id),{x:d.x,z:d.z,y:1,kind:'district',id:String(d.id),source:'explicit coarse model-district anchor'});
 for(const [id,d]of layout?.districts??[])if(finite(d.x)&&finite(d.z))districts.set(String(id),{x:d.x,z:d.z,y:1,kind:'district',id:String(id),source:'coarse model-district anchor'});
 function anchorFor(kind,row,state){
  if(kind==='visibleAgents'&&finite(row.x)&&finite(row.z))return{x:row.x,z:row.z,y:2.4,kind:'person',id:keyOf(row),source:'actual bounded person position'};
  if(kind==='buildings'||kind==='buildingOccupancy')return mapped.get(String(row.buildingId??row.id));
  if(kind==='units')return mapped.get(String(row.buildingId));
  if(kind==='households'){const unit=rows(state,'units').find(u=>u.id===row.unitId);return mapped.get(String(row.buildingId??unit?.buildingId));}
  if(kind==='businesses')return mapped.get(String(row.buildingId));
  if(kind==='districts')return districts.get(String(row.id));
  if(kind==='links'){const a=districts.get(String(row.from)),b=districts.get(String(row.to));if(a&&b)return{x:(a.x+b.x)/2,z:(a.z+b.z)/2,y:1,kind:'link',id:keyOf(row),source:'schematic district-link midpoint, not an actual street'};}
 }
 function add(kind,id,field,a,b,scale,unit,orientation,anchor){
  changedFields++;const delta=b-a,normalizedDelta=delta/scale,change={kind,id,field,sourceField:kind+'['+id+'].'+field,baseline:a,current:b,delta,scale,unit,normalizedDelta,orientedChange:normalizedDelta*orientation};
  if(!anchor){unmappedFields++;const key=kind+':'+id;if(!missing.has(key)){missing.add(key);if(unmapped.length<32)unmapped.push({kind,id,reason:'No supplied stable-ID geographic anchor'});}return;}
  const key=anchor.kind+':'+anchor.id;let group=groups.get(key);if(!group){group={id:key,anchor,strength:0,changes:[],sourceCount:0,omittedSources:0,positive:false,negative:false};groups.set(key,group);}group.sourceCount++;if(group.changes.length<24)group.changes.push(change);else group.omittedSources++;
  group.strength=Math.max(group.strength,Math.min(1,Math.abs(normalizedDelta)));if(change.orientedChange>0)group.positive=true;if(change.orientedChange<0)group.negative=true;
 }
 for(const [kind,fields]of Object.entries(HOTSPOT_SCALES[engine]??{})){
  const before=new Map(rows(baseline,kind).map(row=>[keyOf(row),row]));for(const row of rows(current,kind)){const id=keyOf(row),previous=before.get(id);if(!previous)continue;
   for(const [field,[scale,unit,orientation]]of Object.entries(fields)){const a=valueAt(previous,field),b=valueAt(row,field);if(finite(a)&&finite(b)&&a!==b)add(kind,id,field,a,b,scale,unit,orientation,anchorFor(kind,row,current)??anchorFor(kind,previous,baseline));}
  }
 }
 const all=[...groups.values()].map(g=>({...g,direction:g.positive&&g.negative?'mixed':g.positive?'positive':g.negative?'negative':'neutral',entityRefs:[...new Map(g.changes.map(c=>[c.kind+':'+c.id,{kind:c.kind,id:c.id}])).values()]})).sort((a,b)=>b.strength-a.strength||a.id.localeCompare(b.id));
 return{hotspots:all.slice(0,limit),totalLocations:all.length,omittedLocations:Math.max(0,all.length-limit),changedFields,unmappedFields,unmappedEntityCount:missing.size,unmapped,omittedUnmappedEntities:Math.max(0,missing.size-unmapped.length),normalization:HOTSPOT_SCALES[engine]??{},limits:{hotspots:limit,sourcesPerHotspot:24,unmappedDetails:32},limitations:['Strength=max absolute field change divided by the declared comparison scale, capped at1; scales are analyst display choices, not empirical uncertainty.','Positive/negative follow declared field directions; mixed/neutral are separate and none means total welfare.','Only matched stable IDs and supplied geographic anchors are mapped; missing sample IDs do not imply population changes.','Potential policy scope is excluded. District/link markers remain coarse model anchors, not new physical infrastructure.']};
}
export const HOTSPOT_COLORS=Object.freeze({positive:'#278e74',negative:'#c34a69',mixed:'#8056bb',neutral:'#456fa8'});
export function hotspotExplanation(hotspot){return hotspot.id+' · '+hotspot.direction+' under declared comparison rules · normalized magnitude '+hotspot.strength.toFixed(3)+' · '+hotspot.changes.map(c=>c.sourceField+': '+c.baseline+' → '+c.current+' '+c.unit+' (scale '+c.scale+')').join('; ')+(hotspot.omittedSources?' · '+hotspot.omittedSources+' additional source fields omitted':'');}
export function mountRealityHotspots({THREE,scene}={}){
 const root=new THREE.Group();root.name='recorded-reality-hotspots';scene.add(root);const geometry=new THREE.CircleGeometry(1,24);let report={hotspots:[]},destroyed=false;
 function clear(){for(const mesh of [...root.children]){mesh.material.dispose();root.remove(mesh);}}
 return{update(next,{enabled=true}={}){if(destroyed)return;clear();report=next??{hotspots:[]};root.visible=enabled;for(const hotspot of report.hotspots??[]){const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:HOTSPOT_COLORS[hotspot.direction],transparent:true,opacity:.18+.38*hotspot.strength,depthWrite:false,depthTest:false,side:THREE.DoubleSide}));mesh.rotation.x=-Math.PI/2;mesh.position.set(hotspot.anchor.x,hotspot.anchor.y??1,hotspot.anchor.z);mesh.scale.setScalar(5+18*hotspot.strength);mesh.renderOrder=30;mesh.userData.hotspot=hotspot;root.add(mesh);}},pick(ray){if(!root.visible)return null;const hit=ray.intersectObjects(root.children,false)[0];return hit?{...hit,hotspot:hit.object.userData.hotspot}:null;},getStats:()=>({count:report.hotspots?.length??0,totalLocations:report.totalLocations??0,unmappedFields:report.unmappedFields??0,enabled:root.visible}),destroy(){if(destroyed)return;destroyed=true;clear();geometry.dispose();root.removeFromParent();}};
}
export function drawRealitySvgHotspots(svg,report,{onSelect,enabled=true}={}){
 const group=svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg','g');group.setAttribute('data-reality-hotspots','');group.style.display=enabled?'':'none';svg.append(group);
 for(const hotspot of report.hotspots??[]){const circle=svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg','circle');for(const[k,v]of Object.entries({cx:hotspot.anchor.x,cy:hotspot.anchor.z,r:5+18*hotspot.strength,fill:HOTSPOT_COLORS[hotspot.direction],'fill-opacity':.18+.38*hotspot.strength,stroke:HOTSPOT_COLORS[hotspot.direction],'stroke-width':1,'vector-effect':'non-scaling-stroke'}))circle.setAttribute(k,String(v));const title=svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg','title');title.textContent=hotspotExplanation(hotspot);circle.append(title);circle.style.cursor='pointer';circle.addEventListener('click',event=>{event.stopPropagation();onSelect?.(hotspot);});group.append(circle);}
 return group;
}
