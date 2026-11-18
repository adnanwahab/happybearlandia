/** Viewer-only reads of frozen records. No simulation or persistent writes. */
export class ByteLRU {
 constructor(maxEntries=3,maxBytes=1500000){
  this.maxEntries=maxEntries;
  this.maxBytes=maxBytes;
  this.entries=new Map();
  this.bytes=0;
 }
 get(key){
  const row=this.entries.get(key);
  if(!row)return;
  this.entries.delete(key);
  this.entries.set(key,row);
  return row.value;
 }
 set(key,value){
  const bytes=new TextEncoder().encode(JSON.stringify(value)).length;
  const old=this.entries.get(key);
  if(old){this.bytes-=old.bytes;this.entries.delete(key);}
  if(bytes>this.maxBytes)return;
  this.entries.set(key,{value,bytes});
  this.bytes+=bytes;
  while(this.entries.size>this.maxEntries||this.bytes>this.maxBytes){
   const oldest=this.entries.keys().next().value;
   this.bytes-=this.entries.get(oldest).bytes;
   this.entries.delete(oldest);
  }
 }
}
const invalid=()=>{throw Error('Malformed or incompatible recorded response');};
const jobValid=(job,total)=>
 ['queued','running','partial','completed','failed','unavailable'].includes(job?.status)&&
 job.total===total&&[job.completed,job.failed].every(n=>Number.isInteger(n)&&n>=0)&&
 job.completed+job.failed<=total;
const uint=n=>Number.isInteger(n)&&n>=0&&n<=4294967295;
const metricsValid=metrics=>metrics===null||(
 typeof metrics==='object'&&!Array.isArray(metrics)&&
 Object.values(metrics).every(v=>v===null||(
  Array.isArray(v)&&v.length===3&&v.every(Number.isFinite)&&v[2]===v[1]-v[0]
 ))
);

export class ImpactData {
 constructor(id,{fetcher=fetch,cache=new ByteLRU()}={}){
  this.id=id;
  this.base=`/api/policy-previews/${encodeURIComponent(id)}`;
  this.fetcher=fetcher;
  this.cache=cache;
  this.generation=0;
 }
 cancel(){this.generation++;this.abort?.abort();}
 begin(){
  this.cancel();
  this.abort=new AbortController();
  return {generation:this.generation,signal:this.abort.signal};
 }
 async read(path,signal){
  // Browser fetch must not receive this ImpactData instance as its receiver.
  const fetcher=this.fetcher;
  const response=await fetcher(this.base+path,{credentials:'omit',cache:'no-store',signal});
  const body=await response.json();
  if(!response.ok)throw Error(body.error||`Preview unavailable (${response.status})`);
  if(body.id!==this.id)invalid();
  return body;
 }
 async manifest(signal){
  const m=await this.read('',signal);
  if(!m.input?.legal?.clauses?.length||!Array.isArray(m.parameterDiff)||
   !m.modelVersion||!Array.isArray(m.checkpointMonths)||
   !Number.isInteger(m.input.simulation?.runs)||
   m.input.simulation.runs<1||m.input.simulation.runs>100)invalid();
  return m;
 }
 async summary(month,manifest,signal){
  let offset=0,first;
  const pairs=[];
  do{
   const page=await this.read(`/summary?month=${month}&offset=${offset}&limit=50`,signal);
   if(page.schemaVersion!=='policy-impact-summary.v1'||page.month!==month||
    page.modelVersion!==manifest.modelVersion||
    page.source?.contentHash!==manifest.input.source.contentHash||
    page.page?.offset!==offset||page.page.total!==manifest.input.simulation.runs||
    !jobValid(page.job,manifest.input.simulation.runs)||
    !Array.isArray(page.pairs)||page.pairs.length>50)invalid();
   // A changing job may span two snapshots. Reject rather than combine them.
   if(first&&JSON.stringify(page.job)!==JSON.stringify(first.job)){
    throw Error('Recorded progress changed while paging; retrying is required');
   }
   first??=page;
   for(const pair of page.pairs){
    if(pair.runIndex!==pairs.length||pair.runId!==`${this.id}:pair:${pair.runIndex}`||
     !uint(pair.seed)||!['pending','queued','running','completed','failed'].includes(pair.status)||
     !metricsValid(pair.metrics))invalid();
    pairs.push(pair);
   }
   const next=page.page.nextOffset;
   if(next===null){if(pairs.length!==page.page.total)invalid();break;}
   if(next!==pairs.length||next<=offset||next>=page.page.total)invalid();
   offset=next;
  }while(offset<100);
  return {...first,pairs};
 }
 async pair(row,manifest,signal){
  const key=`${row.runId}:${row.seed}`;
  const cached=this.cache.get(key);
  if(cached)return cached;
  const body=await this.read(`/results?runIndex=${row.runIndex}`,signal);
  if(body.runs?.length!==1)invalid();
  const pair=body.runs[0];
  if(pair.runIndex!==row.runIndex||pair.seed!==row.seed||pair.status!=='completed')invalid();
  for(const side of [pair.baseline,pair.proposal]){
   if(!Array.isArray(side?.checkpoints)||!Array.isArray(side.events)||
    !Array.isArray(side.metricsTimeline))invalid();
   for(const point of side.checkpoints){
    if(!manifest.checkpointMonths.includes(point.month)||point.state?.month!==point.month||
     point.state.seed!==pair.seed||point.state.version!==manifest.modelVersion.split('/')[0]||
     !Array.isArray(point.state.buildings))invalid();
   }
  }
  if(!pair.baseline.checkpoints.some(a=>pair.proposal.checkpoints.some(b=>a.month===b.month)))invalid();
  this.cache.set(key,pair);
  return pair;
 }
}
