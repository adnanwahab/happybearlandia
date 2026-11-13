import {test,expect} from 'bun:test';
import {createGlobalIllumination} from '../world/render/global-illumination.js';
const fixture = (options={}) => {
  const calls={direct:0,post:0,dispose:0,load:0};
  const effect={render(){calls.post++;},dispose(){calls.dispose++;}};
  const control=createGlobalIllumination({renderer:{render(){calls.direct++;}},scene:{},camera:{},mode:'webgpu',load:async()=>{calls.load++;return {createSSGIPipeline:()=>effect};},...options});
  return {control,calls,effect};
};
test('off has zero postprocessing cost; toggles reuse one lazy pipeline and dispose once',async()=>{
  const {control,calls}=fixture();control.render();expect(calls).toEqual({direct:1,post:0,dispose:0,load:0});
  expect(await control.setEnabled(true)).toBe(true);control.render();expect(calls.post).toBe(1);
  await control.setEnabled(false);control.render();expect(calls.direct).toBe(2);
  await control.setEnabled(true);control.render();expect(calls.load).toBe(1);
  control.dispose();control.dispose();expect(calls.dispose).toBe(1);control.render();expect(calls.post).toBe(2);
});
test('unsupported backends never import or execute GI',async()=>{
  for(const mode of ['webgl2','canvas2d']){const {control,calls}=fixture({mode});expect(await control.setEnabled(true)).toBe(false);control.render();expect(calls.load).toBe(0);expect(calls.direct).toBe(1);expect(control.getState().supported).toBe(false);}
});
test('load failure and shader failure preserve direct rendering',async()=>{
  const first=fixture({load:async()=>{throw Error('module unavailable');}});expect(await first.control.setEnabled(true)).toBe(false);first.control.render();expect(first.calls.direct).toBe(1);
  const second=fixture();await second.control.setEnabled(true);second.effect.render=()=>{throw Error('shader failed');};second.control.render();expect(second.calls.direct).toBe(1);expect(second.calls.dispose).toBe(1);expect(second.control.getState().enabled).toBe(false);
});
test('page exit during lazy initialization cannot resurrect the pipeline',async()=>{
  let release;let disposed=0;
  const {control}=fixture({load:()=>new Promise(resolve=>{release=()=>resolve({createSSGIPipeline:()=>({dispose(){disposed++;}})});})});
  const ready=control.setEnabled(true);await Promise.resolve();control.dispose();release();expect(await ready).toBe(false);expect(disposed).toBe(1);
});

test('turning off while an import is pending stays off when it completes',async()=>{
  let release;const {control}=fixture({load:()=>new Promise(resolve=>{release=()=>resolve({createSSGIPipeline:()=>({dispose(){},render(){}})});})});
  const ready=control.setEnabled(true);await Promise.resolve();await control.setEnabled(false);release();expect(await ready).toBe(false);expect(control.getState().enabled).toBe(false);
});
