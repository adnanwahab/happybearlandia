import {test,expect} from 'bun:test';
import {requestProviderJson} from '../world/ai/provider.js';
for(const status of [401,403,429,500,503]) test(`upstream ${status} is redacted`,async()=>{
 try {await requestProviderJson('https://example.invalid',{body:{},fetchImpl:async()=>new Response('private-detail',{status})});throw Error('expected failure');}
 catch(error){expect(error.status).toBe(status===429?429:502);expect(error.message).not.toContain('private-detail');}
});
test('transport forwards cancellation and disallows redirects',async()=>{
 const controller=new AbortController();
 await requestProviderJson('https://example.invalid',{body:{},signal:controller.signal,fetchImpl:async(url,init)=>{expect(init.signal).toBe(controller.signal);expect(init.redirect).toBe('error');return Response.json({});}});
});
