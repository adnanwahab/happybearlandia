import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const DEFAULT_SOURCE='https://dear-congress.fly.dev/';
const text=(value,max=5000)=>typeof value==='string'?value.slice(0,max):'';
/** Public policy fields only: no journal entries, voter records or source-state dumps. */
export function publicPlanSource(payload,{sourceUrl=DEFAULT_SOURCE,retrievedAt=new Date().toISOString(),sourceMode='refreshed-public-plan'}={}){
 const rows=Array.isArray(payload)?payload:payload?.packages||payload?.real;
 if(!Array.isArray(rows)||!rows.length||rows.length>12)throw Error('Dear Congress did not return plan packages.');
 const packages=rows.map(p=>{
  if(!p||typeof p.id!=='string'||!Array.isArray(p.items)||p.items.length>300)throw Error('Unsupported Dear Congress package.');
  return{id:text(p.id,160),name:text(p.name,300),description:text(p.description),totalCost:Number.isFinite(p.totalCost)?p.totalCost:null,budget:Number.isFinite(p.budget)?p.budget:null,items:p.items.map(item=>{
   const row=item.proposal||item;if(!row||typeof row.id!=='string'||typeof row.title!=='string')throw Error('Plan entry lacks its proposal identifier or title.');
   const proposal={};for(const key of ['id','title','needId','mechanism','authority','jurisdiction','legalChange','rightsIssue'])if(typeof row[key]==='string')proposal[key]=text(row[key]);
   for(const key of ['costB','changeLevel','evidence','effectiveness','reversibility'])if(Number.isFinite(row[key]))proposal[key]=row[key];
   proposal.metrics=Array.isArray(row.metrics)?row.metrics.filter(x=>typeof x==='string').slice(0,50).map(x=>text(x,300)):[];return{proposal};
  })};
 });
 const snapshotId='dc-plan-'+createHash('sha256').update(JSON.stringify(packages)).digest('hex').slice(0,16);
 return{schemaVersion:'dear-congress-plan-source.v1',snapshotId,sourceUrl,sourceEndpoint:new URL('api/synthesize',sourceUrl).href,retrievedAt,sourceMode,packageId:packages.find(p=>/balanced/i.test(p.name))?.id||packages[0].id,packages};
}
export function createConstitutionSourceHandler({fetchPlan,sourceUrl=DEFAULT_SOURCE,loadSnapshot=async()=>JSON.parse(await readFile(new URL('./dear-congress-plan.json',import.meta.url),'utf8')),now=()=>new Date().toISOString()}={}){
 let current=null,pending=null;
 const response=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store'}});
 return async request=>{
  if(!['GET','POST'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{allow:'GET, POST'}});
  try{
   if(request.method==='POST'){
    if(typeof fetchPlan!=='function')return response({error:'Plan refresh is unavailable. The captured plan remains usable.'},503);
    // Refresh is explicit. Ordinary world loads never rerun remote synthesis.
    if(!pending)pending=Promise.resolve().then(()=>fetchPlan()).then(payload=>{const next=publicPlanSource(payload,{sourceUrl,retrievedAt:now()});current=next;return next;}).finally(()=>{pending=null;});
    return response(await pending);
   }
   if(!current){const saved=await loadSnapshot();current={...publicPlanSource(saved,{sourceUrl:saved.sourceUrl||sourceUrl,retrievedAt:saved.retrievedAt,sourceMode:saved.sourceMode||'captured-public-plan'}),sourceEndpoint:saved.sourceEndpoint||new URL('api/synthesize',sourceUrl).href};}
   return response(current);
  }catch(error){return response({error:String(error?.message||error),retainedSnapshotAvailable:Boolean(current)},502);}
 };
}
