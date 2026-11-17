import {test,expect} from 'bun:test';
import fixture from '../world/street-photographer/scenario.json';
import {createCase,CLUES} from '../world/street-photographer/case.js';
const attempt=(quest,i,extra={})=>quest.capture({checkpointId:CLUES[i].checkpointId,entityId:CLUES[i].entityId,cameraX:[0,160,360][i],...extra});
test('three-clue integration: wrong date, subject and frame fail before exact checkpoint succeeds',async()=>{
 const before=JSON.stringify(fixture),q=await createCase(fixture);
 expect(attempt(q,0,{checkpointId:'street-cp-2'})).toMatchObject({ok:false,message:expect.stringContaining('Wrong date')});
 expect(attempt(q,0,{entityId:'toy:bench'}).ok).toBe(false);
 expect(attempt(q,0,{cameraX:200}).ok).toBe(false);expect(q.progress).toBe(0);
 for(let i=0;i<3;i++)expect(attempt(q,i)).toMatchObject({ok:true,receipt:{checkpointId:CLUES[i].checkpointId,seed:712}});
 expect(q.progress).toBe(3);expect(attempt(q,2).ok).toBe(false);expect(JSON.stringify(fixture)).toBe(before);
 expect(Object.isFrozen(q.source.checkpoints[0].entities[0])).toBe(true);
});
test('text alternative still requires checkpoint; cancel, resume and restart preserve source',async()=>{
 const q=await createCase(fixture);q.cancel();expect(attempt(q,0).ok).toBe(false);q.resume();
 expect(attempt(q,0,{mode:'inspect',cameraX:NaN}).ok).toBe(true);q.cancel();expect(q.progress).toBe(1);
 q.resume();expect(attempt(q,1,{mode:'inspect',checkpointId:'street-cp-3'}).ok).toBe(false);
 for(let i=1;i<3;i++)expect(attempt(q,i,{mode:'inspect'}).ok).toBe(true);
 const receipts=q.receipts;receipts[0].seed=99;expect(q.receipts[0].seed).toBe(712);
 q.restart();expect(q.progress).toBe(0);expect(q.source).toEqual(fixture);
});
test('missing source and every pinned identity/content mismatch refuse substitute results',async()=>{
 for(const data of [null,{}, {...fixture,checkpoints:[]}])await expect(createCase(data)).rejects.toThrow('No source data');
 for(const key of ['seed','runId','id','rulesVersion','source'])await expect(createCase({...fixture,[key]:'changed'})).rejects.toThrow('Replay mismatch');
 const changed=structuredClone(fixture);changed.checkpoints[0].entities[0].label='Invented';await expect(createCase(changed)).rejects.toThrow('Replay mismatch');
 const q=await createCase(fixture);expect(attempt(q,0,{snapshot:changed.checkpoints[0]}).ok).toBe(false);expect(attempt(q,0,{checkpointId:'missing'}).ok).toBe(false);expect(q.progress).toBe(0);
});
test('matched source replay produces identical receipts with exact frame boundaries',async()=>{
 const a=await createCase(fixture),b=await createCase(fixture);
 expect(attempt(a,0,{cameraX:60}).ok).toBe(true);expect(attempt(b,0,{cameraX:60}).ok).toBe(true);
 for(let i=1;i<3;i++){attempt(a,i);attempt(b,i);}expect(a.receipts).toEqual(b.receipts);
 const c=await createCase(fixture);for(const cameraX of [NaN,Infinity,-1,361,61])expect(attempt(c,0,{cameraX}).ok).toBe(false);
 expect(attempt(c,0,{mode:'spoof'}).ok).toBe(false);expect(c.progress).toBe(0);
});

test('World normal entry links to the native three-clue page and pinned source',async()=>{
 const world=await Bun.file(new URL('../world/index.html',import.meta.url)).text();
 expect(world).toContain('href="/world/street-photographer/index.html"');
 const page=await Bun.file(new URL('../world/street-photographer/index.html',import.meta.url)).text();
 for(const text of ['src="./page.js"','Load pinned demo','Back to World','Inspect text record instead','Checkpoint date'])expect(page).toContain(text);
 const script=await Bun.file(new URL('../world/street-photographer/page.js',import.meta.url)).text();expect(script).toContain("fetch('./scenario.json'");
});
