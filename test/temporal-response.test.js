import {test,expect} from 'bun:test';
import {readTemporalResponse,fetchTemporalResponse} from '../world/temporal/response.js';
test('missing historical API reports actionable route error without JSON SyntaxError',async()=>{await expect(readTemporalResponse(new Response('Not found',{status:404}))).rejects.toThrow('City Time Machine API is unavailable');});
test('HTML source failures and malformed JSON do not leak parser exceptions',async()=>{await expect(readTemporalResponse(new Response('<html>Bad gateway</html>',{status:502,headers:{'content-type':'text/html'}}))).rejects.toThrow('non-JSON response (HTTP 502)');await expect(readTemporalResponse(new Response('Not found',{headers:{'content-type':'application/json'}}))).rejects.toThrow('invalid JSON');});
test('actual API errors and snapshot data retain their original meaning',async()=>{await expect(readTemporalResponse(Response.json({error:'Historical source unavailable'},{status:502}))).rejects.toThrow('Historical source unavailable');expect(await readTemporalResponse(Response.json({id:'snapshot-1',features:[]}))).toEqual({id:'snapshot-1',features:[]});});

test('network failures offer retry instructions without raw browser errors',async()=>{
 await expect(fetchTemporalResponse(async()=>{throw new TypeError('Failed to fetch');},'/history')).rejects.toThrow('Check your connection and select Load date to retry');
});
test('requests have a bounded deadline and preserve caller cancellation',async()=>{
 const pending=(_url,{signal})=>new Promise((resolve,reject)=>{const abort=()=>reject(new DOMException('Aborted','AbortError'));if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});});
 await expect(fetchTemporalResponse(pending,'/history',{timeoutMs:2})).rejects.toThrow('timed out');
 const caller=new AbortController();const request=fetchTemporalResponse(pending,'/history',{signal:caller.signal});caller.abort();await expect(request).rejects.toMatchObject({name:'AbortError'});
});
test('successful requests preserve response data and cache/privacy headers',async()=>{
 let options;expect(await fetchTemporalResponse(async(_url,input)=>{options=input;return Response.json({id:'recorded'});},'/history')).toEqual({id:'recorded'});expect(options.cache).toBe('no-store');expect(options.headers.Accept).toBe('application/json');
});
