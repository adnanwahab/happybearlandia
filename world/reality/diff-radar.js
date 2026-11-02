/** Scan supplied geometry against actual stable-ID pairs. No geometry-only
 * building receives a zero outcome, a forecast, or another district's result. */
import {HOTSPOT_SCALES} from './hotspots.js';
export const DIFF_RADAR_LIMITS=Object.freeze({maxGeometryRecords:100000,maxRegions:4096,maxComparisons:64,maxComparedEntityRows:1000000,maxHotspots:128,maxSourcesPerHotspot:24,maxUnlocatedDetails:64});
export const DIFF_RADAR_EXTRA_SCALES=Object.freeze({parcels:{capacity:[100,'permitted capacity units',0],far:[2,'permitted floor-area ratio',0],landValue:[100000,'modeled USD stock',0]},utilities:{serviceLevel:[.2,'service fraction',1],capacity:[100,'model capacity units',0],demand:[100,'model demand units',0]},finance:{balance:[100000,'USD stock',1],debt:[100000,'USD stock',-1],revenue:[10000,'USD/month',1],operatingExpense:[10000,'USD/month',-1]}});
const finite=Number.isFinite,clone=value=>structuredClone(value),rows=(state,key)=>Array.isArray(state?.[key])?state[key]:[];
const unwrap=value=>value?.snapshot??value?.state??value;
const key=row=>String(row.id??row.personId??row.buildingId);
const get=(row,path)=>path.split('.').reduce((at,part)=>at?.[part],row);
function checked(condition,message){if(!condition)throw new Error(message);}
function centerOf(building){if(Array.isArray(building.center)&&building.center.length===2&&building.center.every(finite))return building.center;const poly=building.poly;if(Array.isArray(poly)&&poly.length>=3&&poly.every(p=>Array.isArray(p)&&p.length===2&&p.every(finite)))return poly.reduce((sum,p)=>[sum[0]+p[0]/poly.length,sum[1]+p[1]/poly.length],[0,0]);return null;}
function indexState(state){const index={};for(const kind of ['buildings','parcels','units','households','businesses','links','utilities','districts','visibleAgents','buildingOccupancy']){index[kind]=new Map();for(const row of rows(state,kind)){const id=key(row);checked(id!=='undefined'&&!index[kind].has(id),`Duplicate/missing modeled ${kind} ID`);index[kind].set(id,row);}}index.parcelBuildings=new Map();for(const building of rows(state,'buildings')){if(building.parcelId==null)continue;const id=String(building.parcelId);if(!index.parcelBuildings.has(id))index.parcelBuildings.set(id,[]);index.parcelBuildings.get(id).push(building.id);}return index;}
function topLocations(groups,limit){
 const heap=[],better=(a,b)=>a.strength>b.strength||a.strength===b.strength&&a.id.localeCompare(b.id)<0,worse=(a,b)=>better(b,a);
 for(const row of groups.values()){
  if(heap.length<limit){heap.push(row);let i=heap.length-1;while(i>0){const parent=(i-1)>>1;if(!worse(heap[i],heap[parent]))break;[heap[i],heap[parent]]=[heap[parent],heap[i]];i=parent;}}
  else if(better(row,heap[0])){heap[0]=row;let i=0;while(true){let worst=i;for(const child of [2*i+1,2*i+2])if(child<heap.length&&worse(heap[child],heap[worst]))worst=child;if(worst===i)break;[heap[i],heap[worst]]=[heap[worst],heap[i]];i=worst;}}
 }
 return heap.sort((a,b)=>b.strength-a.strength||a.id.localeCompare(b.id));
}
export function scanDiffRadar({regions=[],comparisons=[],limit=50}={}){
 checked(Array.isArray(regions)&&regions.length<=4096&&Array.isArray(comparisons)&&comparisons.length<=64,'Radar supports at most4096 regions and64 actual comparisons');checked(Number.isInteger(limit)&&limit>=1&&limit<=128,'Radar limit must be1–128');
 const geometry=new Map(),aliases=new Map(),regionIds=new Set();let geometryRecords=0;
 const alias=(id,physical)=>{if(id==null)return;id=String(id);if(!aliases.has(id))aliases.set(id,new Set());aliases.get(id).add(physical);};
 for(const region of regions){checked(typeof region.id==='string'&&!regionIds.has(region.id)&&Array.isArray(region.buildings),'Unique region IDs and explicit building arrays required');regionIds.add(region.id);for(const building of region.buildings){checked(++geometryRecords<=100000,'Geometry exceeds100000 records; submit an explicitly bounded region batch');checked(building.id!=null||building.sourceId!=null,'Geometry requires stable building/source IDs');const physical=building.sourceId!=null?`source:${building.sourceId}`:`region:${region.id}:${building.id}`;let row=geometry.get(physical);if(!row){row={id:physical,buildingId:building.id??null,sourceId:building.sourceId??null,center:centerOf(building),regionIds:new Set()};geometry.set(physical,row);}row.regionIds.add(region.id);alias(building.id,physical);alias(building.sourceId,physical);}}
 const resolve=id=>{if(id==null)return null;const found=aliases.get(String(id));return found?.size===1?[...found][0]:null;};
 const groups=new Map(),paired=new Set(),changed=new Set(),unlocated=[],seenComparisons=new Set();
 let accepted=0,rejected=0,duplicates=0,comparedRows=0,changedFields=0,unlocatedFields=0,nonGeographicFields=0;
 function add(component,physical){
  if(!physical){unlocatedFields++;if(unlocated.length<64)unlocated.push({...component,reason:'No unique supplied stable-ID building anchor; not painted on nearby geometry.'});return;}
  paired.add(physical);changed.add(physical);const geo=geometry.get(physical);if(!geo.center){unlocatedFields++;if(unlocated.length<64)unlocated.push({...component,buildingId:geo.buildingId,reason:'Stable building is matched but has no valid supplied point/polygon anchor.'});return;}
  let group=groups.get(physical);if(!group){group={id:physical,buildingId:geo.buildingId,sourceId:geo.sourceId,regionIds:[...geo.regionIds],anchor:{kind:'building',id:physical,x:geo.center[0],z:geo.center[1],y:1,source:'supplied geometry center'},strength:0,sourceCount:0,changes:[],omittedSources:0,positive:false,negative:false,comparisonIds:new Set()};groups.set(physical,group);}
  group.strength=Math.max(group.strength,Math.min(1,Math.abs(component.normalizedDelta)));group.sourceCount++;group.comparisonIds.add(component.comparisonId);if(group.changes.length<24)group.changes.push(component);else group.omittedSources++;
  if(component.orientedChange>0)group.positive=true;if(component.orientedChange<0)group.negative=true;
 }
 for(const [i,comparison]of comparisons.entries()){
  const id=String(comparison.runId??comparison.id??`comparison-${i+1}`);if(seenComparisons.has(id)){duplicates++;continue;}seenComparisons.add(id);
  const baseline=unwrap(comparison.baseline??comparison.before),current=unwrap(comparison.treatment??comparison.current??comparison.after),engine=comparison.engine??(Array.isArray(current?.visibleAgents)?'population':'city');
  const time=state=>state?.month??state?.minute,seed=state=>state?.seed??state?.config?.seed??state?.provenance?.seed??comparison.seed;
  if(!baseline||!current||!['city','population'].includes(engine)||!finite(time(baseline))||time(baseline)!==time(current)||!Number.isInteger(seed(baseline))||seed(baseline)!==seed(current)||(baseline.version??baseline.modelVersion)!==(current.version??current.modelVersion)){rejected++;continue;}
  for(const state of [baseline,current])for(const kind of ['buildings','parcels','units','households','businesses','links','utilities','districts','visibleAgents','buildingOccupancy'])comparedRows+=rows(state,kind).length;
  checked(comparedRows<=1000000,'Compared entity rows exceed1000000; submit an explicit bounded comparison batch');accepted++;
  const before=indexState(baseline),after=indexState(current),modeledAliases=new Map();
  for(const state of [baseline,current,comparison.worldContext])for(const building of rows(state,'buildings')){const physical=resolve(building.sourceId)??resolve(building.id);if(physical){const id=String(building.id);modeledAliases.set(id,modeledAliases.has(id)&&modeledAliases.get(id)!==physical?null:physical);}}
  const buildingRef=id=>modeledAliases.has(String(id))?modeledAliases.get(String(id)):resolve(id);
  const rawBefore=comparison.baseline?.state??baseline,rawAfter=(comparison.treatment??comparison.current)?.state??current;
  for(const [buildingId]of before.buildings)if(after.buildings.has(buildingId)){const physical=buildingRef(buildingId);if(physical)paired.add(physical);}
  for(const [buildingId]of before.buildingOccupancy)if(after.buildingOccupancy.has(buildingId)){const physical=buildingRef(buildingId);if(physical)paired.add(physical);}
  function anchors(kind,row,index){
   if(kind==='buildings'||kind==='buildingOccupancy')return[buildingRef(row.buildingId??row.id)];
   if(kind==='units')return[buildingRef(row.buildingId)];
   if(kind==='households'){if(engine==='population'){const raw=index===after?rawAfter:rawBefore,h=Number(String(row.id).replace(`${raw.prefix}-h`,''));if(Number.isInteger(h)&&row.id===`${raw.prefix}-h${h}`&&h>=0&&h<raw.households?.size?.length){const head=raw.households.start[h],location=raw.locations?.[raw.people.homeLocation[head]];return[buildingRef(location?.id)];}}const unit=index.units.get(String(row.unitId));return[buildingRef(row.buildingId??unit?.buildingId)];}
   if(kind==='parcels')return(index.parcelBuildings.get(String(row.id))??[]).map(buildingRef);
   if(kind==='businesses'||kind==='utilities')return[buildingRef(row.buildingId)];
   if(kind==='visibleAgents'){
    if(row.buildingId!=null||row.currentBuildingId!=null)return[buildingRef(row.buildingId??row.currentBuildingId)];
    const raw=index===after?rawAfter:rawBefore,i=row.index;
    if(Number.isInteger(i)&&row.id===`${raw.prefix}-p${i}`&&raw.people?.remaining?.[i]<=0){const location=raw.locations?.[raw.people.currentLocation[i]];return[buildingRef(location?.id)];}
   }
   return[];
  }
  const registry={...HOTSPOT_SCALES[engine],...(engine==='city'?{parcels:DIFF_RADAR_EXTRA_SCALES.parcels,utilities:DIFF_RADAR_EXTRA_SCALES.utilities}:{})};
  for(const [kind,fields]of Object.entries(registry))for(const [entityId,row]of after[kind]??[]){const previous=before[kind]?.get(entityId);if(!previous)continue;
   const refs=[...new Set([...anchors(kind,row,after),...anchors(kind,previous,before)].filter(Boolean))];
   for(const [field,[scale,unit,orientation]]of Object.entries(fields)){const a=get(previous,field),b=get(row,field);if(!finite(a)||!finite(b)||a===b)continue;
    changedFields++;const component={comparisonId:id,engine,kind,id:entityId,field,sourceField:`${kind}[${entityId}].${field}`,baseline:a,current:b,delta:b-a,scale,unit,normalizedDelta:(b-a)/scale,orientedChange:(b-a)/scale*orientation};
    if(refs.length)for(const ref of refs)add(component,ref);else add(component,null);
   }
  }
  if(engine==='city')for(const [field,[scale,unit,orientation]]of Object.entries(DIFF_RADAR_EXTRA_SCALES.finance)){const a=baseline.finance?.[field],b=current.finance?.[field];if(finite(a)&&finite(b)&&a!==b){nonGeographicFields++;if(unlocated.length<64)unlocated.push({comparisonId:id,kind:'finance',field,baseline:a,current:b,delta:b-a,scale,unit,normalizedDelta:(b-a)/scale,orientedChange:(b-a)/scale*orientation,reason:'City-wide finance has no building attribution; no per-building allocation is invented.'});}}
 }
 const hotspots=topLocations(groups,limit).map(row=>({...row,comparisonIds:[...row.comparisonIds],direction:row.positive&&row.negative?'mixed':row.positive?'positive':row.negative?'negative':'neutral'}));
 const coverage={regions:regions.length,geometryBuildings:geometry.size,geometryBuildingRecords:geometryRecords,pairedBuildings:paired.size,unmodeledBuildings:geometry.size-paired.size,changedBuildings:changed.size,unchangedPairedBuildings:paired.size-changed.size,acceptedComparisons:accepted,rejectedComparisons:rejected,duplicateComparisons:duplicates,comparedEntityRows:comparedRows,changedFields,unlocatedFields,nonGeographicFields,hotspotLocations:groups.size,omittedHotspots:Math.max(0,groups.size-limit),ambiguousGeometryAliases:[...aliases.values()].filter(set=>set.size>1).length};
 return{schemaVersion:'reality-diff-radar.v1',hotspots,coverage,unlocated,normalization:{city:HOTSPOT_SCALES.city,population:HOTSPOT_SCALES.population,additional:DIFF_RADAR_EXTRA_SCALES,method:'Maximum absolute recorded delta / declared comparison scale, capped at1. Direction is separate. Maximum over actual comparisons, not probability, affected population or total welfare.'},limits:DIFF_RADAR_LIMITS,batchProposal:coverage.unmodeledBuildings?{status:'requires-explicit-new-simulation',unmodeledBuildings:coverage.unmodeledBuildings,maxComparisonsPerBatch:64,message:'Choose an explicit region/geography initial state, policy, seed and horizon for each bounded batch. Geometry loading alone does not forecast this area.'}:null,limitations:['Only matched stable IDs with same seed/model clock/version are compared. No spatial-nearest or district-to-building copying.','Unmodeled buildings are unavailable, never zero impact. Sparse unmatched occupancy/people records do not imply zero, births, deaths or migration.','City-wide finances and unanchored people, services and links are reported separately; they are not allocated to building footprints.','Scales are analyst display choices. Positive/negative reflect declared field orientations, not a welfare verdict.','Streaming coverage and actual forecast coverage are different; no new model runs are started by scanning.']};
}
