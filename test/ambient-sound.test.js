import {test,expect} from 'bun:test';
import {ambientScene,createAmbientMixer,LOOP_BYTES} from '../world/ambient/mixer.js';
import {MEDIA_BUDGETS} from '../shared/media/pipeline.js';
function fixture() {
  const params=[],sources=[]; let resumes=0,closes=0,suspends=0;
  const param=()=>{const p={value:0,targets:[],cancelScheduledValues(){},setTargetAtTime(...args){this.targets.push(args);}};params.push(p);return p;};
  const context={currentTime:3,destination:{},createBuffer:(_,n)=>({getChannelData:()=>new Float32Array(n)}),createGain:()=>({gain:param(),connect(){},disconnect(){}}),createStereoPanner:()=>({pan:param(),connect(){},disconnect(){}}),createBufferSource:()=>{const s={connect(){},disconnect(){this.disconnected=true;},start(){},stop(){this.stopped=true;}};sources.push(s);return s;},async resume(){resumes++;},async suspend(){suspends++;},async close(){closes++;}};
  let creations=0;
  const mixer=createAmbientMixer({createContext:()=>{creations++;return context;}});
  return {mixer,params,sources,stats:()=>({creations,resumes,closes,suspends})};
}
test('geometry/time heuristics are cosmetic and handle missing inputs',()=>{
  expect(ambientScene()).toBeNull();expect(ambientScene({target:{x:NaN,z:0},minute:0})).toBeNull();
  const input={target:{x:0,z:0},height:10,minute:720,buildings:[{kind:'park',center:[0,0]}]};const before=JSON.stringify(input);
  expect(ambientScene(input)).toEqual({environment:'park',night:false,pan:0});expect(JSON.stringify(input)).toBe(before);
  expect(ambientScene({...input,height:200}).environment).toBe('skyline');
  expect(ambientScene({...input,buildings:Array(4).fill({kind:'home',center:[10,10]}),minute:-1})).toEqual({environment:'avenue',night:true,pan:0});
  expect(ambientScene({...input,buildings:[]} ).environment).toBe('skyline');
  expect(ambientScene({...input,minute:360}).night).toBe(false);expect(ambientScene({...input,minute:1200}).night).toBe(true);
});
test('silent until opt-in, bounded buffers, independent switch and smooth rapid navigation',async()=>{
  const f=fixture(); f.mixer.volume(1); f.mixer.update({environment:'park',night:false,pan:0});
  expect(f.stats().creations).toBe(0);expect(LOOP_BYTES).toBeLessThan(MEDIA_BUDGETS.audio);
  await f.mixer.enable(true);expect(f.sources).toHaveLength(3);
  expect(f.params[2].targets.at(-1)).toEqual([.38,3,.25]);
  for(let i=0;i<100;i++)f.mixer.update({environment:i%2?'park':'avenue',night:true,pan:.2});
  expect(f.sources).toHaveLength(3);expect(f.stats().creations).toBe(1);
  await f.mixer.enable(false);for(const p of [f.params[0],f.params[2],f.params[4]])expect(p.targets.at(-1)[0]).toBe(0);
  await f.mixer.enable(true);f.mixer.volume(0);for(const p of [f.params[0],f.params[2],f.params[4]])expect(p.targets.at(-1)[0]).toBe(0);
  f.mixer.hidden(true);expect(f.stats().suspends).toBe(1);
  f.mixer.update(null);f.mixer.dispose();f.mixer.dispose();expect(f.stats().closes).toBe(1);
  for(const s of f.sources){expect(s.stopped).toBe(true);expect(s.disconnected).toBe(true);expect(s.buffer).toBeNull();}
  expect(await f.mixer.enable(true)).toBe(false);
});
test('rapid opt-out and disposal cannot be undone by pending resume',async()=>{
  const f=fixture();const enabling=f.mixer.enable(true);await f.mixer.enable(false);expect(await enabling).toBe(false);
  const pending=f.mixer.enable(true);f.mixer.dispose();expect(await pending).toBe(false);
});
test('unsupported audio is a silent failure',async()=>{
  const mixer=createAmbientMixer({createContext:()=>{throw Error('unsupported');}});
  expect(await mixer.enable(true)).toBe(false);mixer.update(null);mixer.dispose();
});
test('illustrative proximity strength scales bounded audio and missing scene mutes',async()=>{
 const f=fixture();f.mixer.volume(.15);f.mixer.update({environment:'avenue',strength:1,pan:0});await f.mixer.enable(true);
 expect(f.params[4].targets.at(-1)[0]).toBeCloseTo(.057);
 f.mixer.update({environment:'avenue',strength:.5});expect(f.params[4].targets.at(-1)[0]).toBeCloseTo(.0285);
 f.mixer.update({environment:'avenue',strength:100});expect(f.params[4].targets.at(-1)[0]).toBeCloseTo(.057);
 f.mixer.update({environment:'avenue',strength:-1});expect(f.params[4].targets.at(-1)[0]).toBe(0);
 f.mixer.update(null);expect(f.params[4].targets.at(-1)[0]).toBe(0);f.mixer.dispose();
});
