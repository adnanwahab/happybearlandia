import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {mkdirSync,openSync,writeFileSync,closeSync,readFileSync,constants,lstatSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
/** Protected persistent key; only used for isolated loopback capabilities. */
export function loadLocalCapabilitySecret(path='.data/local-capability/key') {
 path=resolve(path);mkdirSync(dirname(path),{recursive:true,mode:0o700});
 try{const fd=openSync(path,'wx',0o600);try{writeFileSync(fd,randomBytes(32));}finally{closeSync(fd);}}catch(error){if(error.code!=='EEXIST')throw error;}
 const stat=lstatSync(path);if(!stat.isFile()||stat.isSymbolicLink()||(stat.mode&0o077))throw Error('Unsafe capability key permissions');
 const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);try{const secret=readFileSync(fd);if(secret.length!==32)throw Error('Invalid capability key');return secret;}finally{closeSync(fd);}
}
/** Requires real loopback peer plus same-origin guards. Not hosted user auth. */
export function createLocalCapabilityBoundary({random=()=>randomBytes(16).toString('hex'),now=Date.now,isLocalPeer=()=>false,secret=randomBytes(32)}={}) {
 const json=(value,options={})=>Response.json(value,{...options,headers:{'cache-control':'no-store','x-content-type-options':'nosniff',...options.headers}});
 const ttl=86400000,sign=value=>createHmac('sha256',secret).update(value).digest('base64url');
 const local=url=>['127.0.0.1','localhost','[::1]'].includes(url.hostname);
 function owner(request){const url=new URL(request.url);if(!local(url)||!isLocalPeer(request))return null;const origin=request.headers.get('origin');if((!['GET','HEAD'].includes(request.method)&&origin!==url.origin)||(origin&&origin!==url.origin))return null;if(request.headers.get('sec-fetch-site')==='cross-site')return null;const token=request.headers.get('cookie')?.match(/(?:^|;\s*)hbl_local_cap=([a-zA-Z0-9_.-]{1,160})(?:;|$)/)?.[1];if(!token)return null;const [identity,expires,signature,...extra]=token.split('.');if(extra.length||!/^[a-f0-9]{32}$/.test(identity)||!/^\d{13}$/.test(expires)||Number(expires)<=now()||Number(expires)>now()+ttl||!signature)return null;const expected=sign(`${identity}.${expires}`),a=Buffer.from(signature),b=Buffer.from(expected);return a.length===b.length&&timingSafeEqual(a,b)?identity:null;}
 return {owner,handle(request){const url=new URL(request.url);if(url.pathname!=='/api/local-capability')return null;if(!local(url)||!isLocalPeer(request)||request.method!=='POST'||request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'Local same-origin capability required'},{status:403});if(owner(request))return json({localOnly:true},{headers:{'cache-control':'no-store'}});const identity=random(),body=`${identity}.${now()+ttl}`,token=`${body}.${sign(body)}`;return json({localOnly:true},{headers:{'cache-control':'no-store','set-cookie':`hbl_local_cap=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=86400`}});}};
}
