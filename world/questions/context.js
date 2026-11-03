/** Browser-safe, allowlisted synthetic viewport context. No full agent records. */
export const OPEN_QUESTIONS_LIMIT=32768;
const text=(value,max=300)=>typeof value==='string'?value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').slice(0,max):null;
const number=value=>Number.isFinite(value)?value:null;
const safeKey=key=>/^[A-Za-z][A-Za-z0-9_.:-]{0,79}$/.test(key)&&!/secret|password|token|api.?key|email|phone|address/i.test(key);
const scalars=(value,numeric=false)=>Object.fromEntries(Object.entries(value&&typeof value==='object'&&!Array.isArray(value)?value:{}).slice(0,80).filter(([key,v])=>safeKey(key)&&(Number.isFinite(v)||!numeric&&(typeof v==='boolean'||typeof v==='string'))).map(([key,v])=>[key,typeof v==='string'?text(v,120):v]));
export function sanitizeOpenQuestionsContext(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('A viewport context object is required.');
 const context={source:'Client-supplied synthetic simulation context; not verified real-world observations.',origin:{},bounds:{},selectedEntity:null,visibleBuildingIds:[],config:scalars(input.config),metrics:scalars(input.metrics,true),recentLogs:[],pairedDiffs:[]};
 for(const key of ['lat','lng'])if(Number.isFinite(input.origin?.[key]))context.origin[key]=input.origin[key];
 if(context.origin.lat!==undefined&&Math.abs(context.origin.lat)>90||context.origin.lng!==undefined&&Math.abs(context.origin.lng)>180)throw new Error('Invalid viewport origin.');
 for(const key of ['minX','maxX','minZ','maxZ','south','north','west','east'])if(Number.isFinite(input.bounds?.[key]))context.bounds[key]=input.bounds[key];
 if(input.selectedEntity&&text(input.selectedEntity.id,96))context.selectedEntity={id:text(input.selectedEntity.id,96),kind:text(input.selectedEntity.kind,40),label:text(input.selectedEntity.label,120)};
 context.visibleBuildingIds=[...new Set((Array.isArray(input.visibleBuildingIds)?input.visibleBuildingIds:[]).map(id=>text(id,96)).filter(Boolean))].slice(0,100);
 context.recentLogs=(Array.isArray(input.recentLogs)?input.recentLogs:[]).slice(-40).filter(row=>row&&typeof row==='object'&&!Array.isArray(row)).map((row,index)=>({id:text(row.id,96)??`recent-${index}`,time:typeof row.time==='string'?text(row.time,80):number(row.time),type:text(row.type,80),text:text(row.text,400),entityId:text(row.entityId,96)}));
 context.pairedDiffs=(Array.isArray(input.pairedDiffs)?input.pairedDiffs:[]).slice(0,30).filter(row=>row&&typeof row==='object').map((row,index)=>({id:text(row.id,96)??`diff-${index}`,metric:text(row.metric,80),baseline:number(row.baseline),current:number(row.current),delta:number(row.delta),entityId:text(row.entityId,96)}));
 if(new TextEncoder().encode(JSON.stringify(context)).length>OPEN_QUESTIONS_LIMIT)throw new Error('Viewport context exceeds32KiB.');
 return context;
}
export function openQuestionsEvidence(context){
 return [{id:'viewport',kind:'viewport',record:{origin:context.origin,bounds:context.bounds}},...(context.selectedEntity?[{id:'selected:'+context.selectedEntity.id,kind:'selectedEntity',record:context.selectedEntity}]:[]),...context.visibleBuildingIds.map(id=>({id:'building:'+id,kind:'visibleBuilding',record:{id}})),...Object.entries(context.config).map(([key,value])=>({id:'config:'+key,kind:'config',record:{key,value}})),...Object.entries(context.metrics).map(([key,value])=>({id:'metric:'+key,kind:'metric',record:{key,value}})),...context.recentLogs.map((record,index)=>({id:`log:${index}:${record.id}`,kind:'retainedLog',record})),...context.pairedDiffs.map((record,index)=>({id:`diff:${index}:${record.id}`,kind:'pairedDiff',record}))];
}
