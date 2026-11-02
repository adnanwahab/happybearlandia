import {test,expect} from 'bun:test';
import {createDecisionClient,createRunTraceCache,mergeRunTrace} from '../world/decision/client.js';

test('client bulk requests explicitly opt into compact projection; full run endpoint is unchanged',async()=>{
  const urls=[];const client=createDecisionClient({fetcher:async(url)=>{urls.push(url);return Response.json(url.endsWith('/runs/r')?{run:{id:'r'}}:{experiment:{id:'e',status:'completed'},runs:[]})}});
  await client.results('e');await client.share('e');await client.results('e',{traces:'full'});await client.run('e','r');await client.visualRevision('e',{});
  await new Promise((resolve,reject)=>client.watch('e',{onUpdate:resolve,onError:reject}));
  expect(urls).toEqual(['/api/decision-experiments/e/results?traces=summary','/api/decision-experiments/e/share?traces=summary','/api/decision-experiments/e/results','/api/decision-experiments/e/runs/r','/api/decision-experiments/e/visual-revision?traces=summary','/api/decision-experiments/e/results?traces=summary']);
});
test('trace cache deduplicates requests, caps loaded traces at two and invalidates old experiment responses',async()=>{
  const pending=new Map();let calls=0;const cache=createRunTraceCache({loadRun:(e,r)=>{calls++;return new Promise(resolve=>pending.set(`${e}/${r}`,resolve))}});
  const first=cache.get('e','a'),duplicate=cache.get('e','a');await Promise.resolve();expect(calls).toBe(1);pending.get('e/a')({run:{id:'a',experimentId:'e'}});await first;await duplicate;
  for(const id of ['b','c']){const p=cache.get('e',id);await Promise.resolve();pending.get(`e/${id}`)({run:{id,experimentId:'e'}});await p;}
  expect(cache.size).toBe(2);expect(cache.peek('e','a')).toBeNull();
  const stale=cache.get('e','old');await Promise.resolve();cache.setExperiment('new');pending.get('e/old')({run:{id:'old',experimentId:'e'}});expect(await stale).toBeNull();expect(cache.size).toBe(0);expect(cache.experimentId).toBe('new');
});
test('hydration overlays trace arrays without replacing newer metrics, lifecycle or progress metadata',()=>{
 const summary={id:'r',status:'completed',metrics:{supply:200},traceDelivery:'on-demand',projects:[{projectId:'p',states:[],stateCount:121}],monthlyTimelineCount:121};
 const full={id:'r',status:'running',metrics:{supply:100},projects:[{projectId:'p',states:[{month:0},{month:120}]}],monthlyTimeline:[{month:120}]};
 const merged=mergeRunTrace(summary,full);expect(merged.status).toBe('completed');expect(merged.metrics.supply).toBe(200);expect(merged.projects[0].states).toHaveLength(2);expect(merged.monthlyTimelineCount).toBe(121);expect(merged.traceDelivery).toBe('loaded');expect(summary.projects[0].states).toHaveLength(0);
});
