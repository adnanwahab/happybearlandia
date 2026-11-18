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

import {validateLive} from '../world/decision/backlog-provider-compatibility/live.js';
test('live harness defaults to exactly zero calls and requires authorization plus configuration',async()=>{
 let calls=0;const fetchImpl=()=>{calls++;throw Error('private credential');};
 expect(await validateLive({env:{},fetchImpl})).toEqual({status:'skipped',calls:0});
 expect(await validateLive({env:{HBL_AUTHORIZE_PAID_VALIDATION:'I_AUTHORIZE_ONE_PAID_REQUEST'},fetchImpl})).toEqual({status:'configuration-required',calls:0});
 expect(calls).toBe(0);
});
test('invalid JSON produces a redacted error',async()=>{
 await expect(requestProviderJson('https://example.invalid',{body:{},fetchImpl:async()=>new Response('private invalid JSON')})).rejects.toThrow('AI provider returned invalid JSON');
});
