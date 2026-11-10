import {ForkError} from './engine.js';
import {assertWorldWriteOrigin} from '../experiments/persistence-api.js';
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function createCounterfactualHandler({engine,authenticate=async()=>null,maxBytes=65536}={}){
 return async request=>{try{
  const url=new URL(request.url),parts=url.pathname.split('/').filter(Boolean);
  if(parts[0]!=='api'||parts[1]!=='causality'||!['forks','jobs'].includes(parts[2]))throw new ForkError(404,'not_found','Fork endpoint not found');
  if(!engine)throw new ForkError(503,'fork_unavailable','Fork dependencies are unavailable');
  const actor=await authenticate(request);if(!actor)throw new ForkError(403,'forbidden','Authentication required');
  if(request.method==='POST'&&parts.length===3&&parts[2]==='forks'){
   assertWorldWriteOrigin(request,{label:'Counterfactual'});
   const reader=request.body?.getReader();let size=0,chunks=[];if(reader)while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new ForkError(413,'payload_too_large','Fork request exceeds size limit');}chunks.push(value);}
   const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}let input;try{input=JSON.parse(new TextDecoder().decode(data));}catch{throw new ForkError(400,'invalid_json','Invalid JSON');}
   return json(await engine.submit(actor,input,request.headers.get('idempotency-key')),202);
  }
  if(request.method==='GET'&&parts.length===4){const id=decodeURIComponent(parts[3]);return json(parts[2]==='jobs'?await engine.getJob(actor,id):await engine.getBranch(actor,id));}
  if(request.method==='GET'&&parts.length===5&&parts[2]==='forks'&&parts[4]==='lineage')return json({lineage:await engine.lineage(actor,decodeURIComponent(parts[3]))});
  throw new ForkError(404,'not_found','Fork endpoint not found');
 }catch(error){const status=error.status|| (error instanceof URIError?400:503);return json({error:{code:error.code|| (status===403?'forbidden':'fork_unavailable'),message:error.status?error.message:'Fork service unavailable'}},status);}};
}
