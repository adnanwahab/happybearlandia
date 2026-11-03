/** Physical-date tags only. OSM edit timestamps, versions and snapshot dates
 * never establish building age. Opening/start tags retain their distinct meaning. */
export const BUILDING_DATE_KEYS=Object.freeze(['construction_date','year_of_construction','start_date','opening_date']);
export function buildingDateTags(tags={}){return Object.fromEntries(BUILDING_DATE_KEYS.filter(key=>typeof tags[key]==='string'&&tags[key].length<=80).map(key=>[key,tags[key]]));}
function parsedDate(value){
 const match=/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(value.trim());if(!match)return null;
 const year=Number(match[1]),month=Number(match[2]??1),day=Number(match[3]??1);if(year<1||month<1||month>12||day<1||day>31)return null;
 const date=new Date(0);date.setUTCFullYear(year,month-1,day);if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return null;
 return{year,precision:match[3]?'day':match[2]?'month':'year',date:value.trim()};
}
export function buildingDateEvidence(building={}){
 const tags=building.dateTags??building.tags??building.properties??{};
 const evidence=BUILDING_DATE_KEYS.flatMap(key=>{const raw=tags[key];if(typeof raw!=='string')return[];const parsed=parsedDate(raw);return parsed?[{...parsed,tag:key,raw,meaning:key==='opening_date'?'opening':key==='start_date'?'start':'construction',source:'OSM physical-date tag',verified:false}]:[];});
 return{status:evidence.length?'tagged':'unknown',primary:evidence[0]??null,evidence,limitations:'Contributor-supplied physical-date tags, not independently verified construction history. Missing or ambiguous dates remain unknown.'};
}
export function normalizeBuildingDateFilter({enabled=false,minYear=1,maxYear=9999,fadeUnknown=false,opacity=.12}={}){if(!Number.isInteger(minYear)||!Number.isInteger(maxYear)||minYear<1||maxYear>9999||minYear>maxYear||!Number.isFinite(opacity)||opacity<0||opacity>1)throw new Error('Building date filter needs ordered years1–9999 and opacity0–1');return{enabled:!!enabled,minYear,maxYear,fadeUnknown:!!fadeUnknown,opacity};}
export function buildingDateDecision(building,options={}){const filter=normalizeBuildingDateFilter(options),date=buildingDateEvidence(building),known=date.status==='tagged',outside=known&&(date.primary.year<filter.minYear||date.primary.year>filter.maxYear),faded=filter.enabled&&(outside||(!known&&filter.fadeUnknown));return{known,outside,faded,opacity:faded?filter.opacity:1,date};}
export function buildingDateCounts(buildings,options={}){const counts={total:0,known:0,unknown:0,outside:0,faded:0};for(const building of buildings){const row=buildingDateDecision(building,options);counts.total++;counts[row.known?'known':'unknown']++;if(row.outside)counts.outside++;if(row.faded)counts.faded++;}return counts;}
/** Renderer bridge: register each actual building root (including later streaming
 * and HLOD decoration roots) with its source building. Materials are cloned per
 * root mesh so neighboring buildings sharing a material never fade together.
 * Supply getHLODEnabled/setHLODEnabled to disable merged HLOD while active and
 * restore its prior flag on disable/destroy. This trades active-filter performance
 * for correct per-building transparency. Other merged/instanced batches require
 * renderer partitioning or per-instance alpha. */
export function createBuildingDateFilter({onChange=()=>{},getHLODEnabled,setHLODEnabled}={}){
 let filter=normalizeBuildingDateFilter(),priorHLOD;const roots=new Map(),owned=new Map();
 const syncHLOD=enabled=>{if(typeof getHLODEnabled!=='function'||typeof setHLODEnabled!=='function')return;if(enabled&&priorHLOD===undefined){priorHLOD=getHLODEnabled();setHLODEnabled(false);}else if(!enabled&&priorHLOD!==undefined){setHLODEnabled(priorHLOD);priorHLOD=undefined;}};
 const release=object=>{const record=owned.get(object);if(!record)return;if(object.material===record.assigned)object.material=record.source;for(const material of record.clones)material.dispose?.();owned.delete(object);};
 function apply(root,building){const decision=buildingDateDecision(building,filter);
  // Default OFF does not traverse, clone, or dirty any material.
  if(!filter.enabled)return decision;
  const visit=object=>{if(!object.material)return;let record=owned.get(object);
   // Progressive geometry may replace a placeholder material between refreshes.
   if(record&&object.material!==record.assigned){release(object);record=null;}
   if(!decision.faded){release(object);return;}
   if(!record){const source=object.material,materials=Array.isArray(source)?source:[source],clones=materials.map(material=>{const clone=material.clone();clone.onBeforeCompile=material.onBeforeCompile;clone.customProgramCacheKey=material.customProgramCacheKey;return clone;});record={root,source,clones,base:materials.map(material=>({opacity:material.opacity??1})),assigned:Array.isArray(source)?clones:clones[0],opacity:null};owned.set(object,record);object.material=record.assigned;}
   if(record.opacity!==decision.opacity){for(const[index,material]of record.clones.entries()){const wasTransparent=material.transparent;material.opacity=record.base[index].opacity*decision.opacity;material.transparent=true;material.depthWrite=false;if(!wasTransparent)material.needsUpdate=true;}record.opacity=decision.opacity;}
  };if(root.traverse)root.traverse(visit);else visit(root);return decision;
 }
 return{register(root,building){roots.set(root,building);return apply(root,building);},unregister(root){for(const[object,record]of owned)if(record.root===root)release(object);roots.delete(root);},set(options){filter=normalizeBuildingDateFilter({...filter,...options});syncHLOD(filter.enabled);if(filter.enabled){for(const[root,building]of roots)apply(root,building);}else for(const object of owned.keys())release(object);onChange({...filter});return{...filter};},get(){return{...filter};},refresh(){if(filter.enabled)for(const[root,building]of roots)apply(root,building);},counts(buildings=[...new Set(roots.values())]){return buildingDateCounts(buildings,filter);},destroy(){for(const object of owned.keys())release(object);roots.clear();syncHLOD(false);}};
}
