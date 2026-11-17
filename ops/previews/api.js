import {timingSafeEqual,createHash} from 'node:crypto';
import {GitHubMetadata,PreviewError,pullNumber,validSHA} from './github.js';
export function equalSecret(a,b) {return typeof a==='string'&&typeof b==='string'&&a.length>=32&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));}
export function authorize(request, token, {origin = true, expectedOrigin} = {}) {
  if (!token) throw new PreviewError('Preview creation is disabled. Configure an authenticated operator and the separate trusted runner.',503);
  const supplied=request.headers.get('authorization')?.replace(/^Bearer /,'');
  if (!equalSecret(supplied,token)) throw new PreviewError('Maintainer authentication required',401);
  if (origin && request.headers.get('origin') !== (expectedOrigin || new URL(request.url).origin)) throw new PreviewError('Same-origin request required',403);
  if (request.headers.get('sec-fetch-site') === 'cross-site') throw new PreviewError('Cross-site request rejected',403);
  return createHash('sha256').update(supplied).digest('hex');
}
export async function jsonBody(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new PreviewError('JSON required',415);
  const reader=request.body?.getReader(); let bytes=0, chunks=[];
  if(reader) { try { while(true){ const {value,done}=await reader.read(); if(done)break; bytes+=value.length; if(bytes>2048){await reader.cancel();throw new PreviewError('Request too large',413);}chunks.push(value); } } finally { reader.releaseLock(); } }
  try{return JSON.parse(Buffer.concat(chunks).toString());}catch(e){if(e instanceof PreviewError)throw e;throw new PreviewError('Invalid JSON');}
}
export function publicJob(job) {const {id,sha,number,repository,recipe,state,createdAt,updatedAt,error,url,launchPath}=job;return {id,sha,number,repository,recipe,state,createdAt,updatedAt,error,url:state==='ready'?url:null,launchPath};}
export function errorResponse(error) {const known=error instanceof PreviewError;return Response.json({error:known?error.message:'Preview operation failed; consult the trusted runner diagnostics.'},{status:known?error.status:503,headers:{'cache-control':'no-store',...(error.retryAfter?{'retry-after':String(error.retryAfter)}:{})}});}
export function createGitHubHandler({metadata=new GitHubMetadata(),runnerURL=process.env.HBL_PREVIEW_RUNNER_URL,runnerToken=process.env.HBL_PREVIEW_RUNNER_TOKEN,operatorToken=process.env.HBL_PREVIEW_OPERATOR_TOKEN,publicOrigin=process.env.HBL_PUBLIC_ORIGIN,fetchImpl=fetch}={}) {
  async function proxy(path,request) {
    if(!runnerURL||!runnerToken)throw new PreviewError('Preview runner unavailable. Start the isolated trusted runner; browsing remains read-only.',503);
    const target=new URL(runnerURL);
    if(!((target.protocol==='http:'&&['127.0.0.1','[::1]'].includes(target.hostname))||target.protocol==='https:')||target.username||target.password||target.pathname!=='/')throw new PreviewError('Invalid trusted runner configuration',503);
    const response=await fetchImpl(new URL(path,target),{method:request.method,headers:{Authorization:`Bearer ${runnerToken}`,'content-type':'application/json'},body:request.method==='GET'?undefined:JSON.stringify(await jsonBody(request)),redirect:'error',signal:AbortSignal.timeout(15000)});
    return new Response(await response.text(),{status:response.status,headers:{'content-type':'application/json','cache-control':'no-store',...(response.headers.get('retry-after')?{'retry-after':response.headers.get('retry-after')}:{})}});
  }
  return async request=> {
    const url=new URL(request.url),path=url.pathname;
    if(!path.startsWith('/api/github/'))return null;
    try {
      if(path==='/api/github/pulls'&&request.method==='GET')return Response.json(await metadata.list(url.searchParams),{headers:{'cache-control':'no-store'}});
      let m=path.match(/^\/api\/github\/pulls\/([1-9]\d{0,7})$/);
      if(m&&request.method==='GET')return Response.json(await metadata.detail(m[1]),{headers:{'cache-control':'no-store'}});
      m=path.match(/^\/api\/github\/pulls\/([1-9]\d{0,7})\/previews$/);
      if(m&&request.method==='POST'){authorize(request,operatorToken,{expectedOrigin:publicOrigin});return await proxy(path,request);}
      m=path.match(/^\/api\/github\/previews\/([a-f0-9]{32})(?:\/(retry|stop|touch))?$/);
      if(m&&(request.method==='GET'&&!m[2]||request.method==='POST'&&m[2])) {if(request.method==='POST')authorize(request,operatorToken,{expectedOrigin:publicOrigin});return await proxy(path,request);}
      throw new PreviewError('GitHub route or method not found',404);
    } catch(error){return errorResponse(error);}
  };
}
export function createRunnerHandler({store,metadata,token}={}) {
  return async request=> {
    try {
      const actor=authorize(request,token,{origin:false}),path=new URL(request.url).pathname;
      let m=path.match(/^\/api\/github\/pulls\/([1-9]\d{0,7})\/previews$/);
      if(m&&request.method==='POST') {
        const body=await jsonBody(request);
        if(!body||Object.keys(body).some(k=>!['expectedSha','mode','launchPath'].includes(k))||body.mode!=='head'||!validSHA(body.expectedSha)||!['/','/world'].includes(body.launchPath))throw new PreviewError('Only a displayed exact PR head and verified application path are accepted');
        const pr=await metadata.detail(pullNumber(m[1]),true);
        if(!['open','draft'].includes(pr.status))throw new PreviewError('Only open pull requests can be previewed',409);
        if(pr.sha!==body.expectedSha)return Response.json({error:'The PR head changed. Review the new SHA and click again.',sha:pr.sha},{status:409});
        const result=store.admit({sha:pr.sha,number:pr.number,launchPath:body.launchPath,actor});
        if(result.reused&&['expired','failed'].includes(result.job.state))return Response.json({job:publicJob(result.job),reused:true,retryRequired:true},{status:200});
        return Response.json({job:publicJob(result.job),reused:result.reused},{status:result.reused?200:202});
      }
      m=path.match(/^\/api\/github\/previews\/([a-f0-9]{32})(?:\/(retry|stop|touch))?$/);
      if(m&&request.method==='GET'&&!m[2])return Response.json(publicJob(store.get(m[1])));
      if(m&&request.method==='POST'&&m[2]) {
        await jsonBody(request); const job=store.get(m[1]);
        if(m[2]==='retry') {const pr=await metadata.detail(job.number,true);if(!['open','draft'].includes(pr.status)||pr.sha!==job.sha)throw new PreviewError('PR head changed or closed; return to detail and deliberately select its current SHA.',409);return Response.json(publicJob(store.retry(job.id,actor)),{status:202});}
        if(m[2]==='stop')return Response.json(publicJob(store.update(job,{stopRequested:true})),{status:202});
        return Response.json(publicJob(store.update(job,{lastUsedAt:store.now()})));
      }
      throw new PreviewError('Runner route not found',404);
    } catch(error){return errorResponse(error);}
  };
}
