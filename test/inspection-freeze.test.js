import {test,expect} from 'bun:test';
import {createInspectionFreeze} from '../world/render/inspection-freeze.js';
import {rankScreenTargets} from '../world/render/magnetic-picking.js';
test('freezing retains capture identity without changing model tick or pause',()=>{
 const model={tick:12,paused:false,ids:['person-8']};let releases=0;
 const gate=createInspectionFreeze({capture:()=>model.ids,release:ids=>{expect(ids).toBe(model.ids);releases++;}});
 expect(gate.toggle()).toBe(true);expect(model).toEqual({tick:12,paused:false,ids:['person-8']});
 model.tick++;gate.record(16);gate.record(25);expect(gate.getState()).toMatchObject({frames:2,maxFrameMs:25});
 gate.toggle();expect(model.tick).toBe(13);expect(releases).toBe(1);gate.clear();expect(releases).toBe(1);
});
test('unsupported and failed captures remain live',()=>{
 const unsupported=createInspectionFreeze({supported:()=>false,capture:()=>{throw Error('must not capture');}});
 expect(unsupported.toggle()).toBe(false);expect(unsupported.getState().error).toContain('Unavailable');
 const failed=createInspectionFreeze({capture:()=>{throw Error('private detail');}});
 expect(failed.toggle()).toBe(false);expect(failed.frozen).toBe(false);expect(failed.getState().error).toBe('Could not freeze this scene');
});
test('exact inspection does not select nearby silhouettes',()=>{
 let rays=0;const result=rankScreenTargets({x:50,y:50,rect:{left:0,top:0,right:100,bottom:100},radius:0,hitAt(x){rays++;return x===50?null:{key:'neighbor'};}});
 expect(result.choices).toEqual([]);expect(rays).toBe(1);
});

import {readFileSync} from 'node:fs';
test('World integration advances its model before the presentation gate and keeps the exact picker',()=>{
 const source=readFileSync('world/render.js','utf8'),frame=source.slice(source.indexOf('function frame(now)'));
 expect(frame.indexOf('world.step(minutes)')).toBeLessThan(frame.indexOf('if(inspectionFreeze.frozen){'));
 expect(frame.indexOf('if(inspectionFreeze.frozen){')).toBeLessThan(frame.indexOf('livingWorld?.update(now)'));
 expect(source).toContain('radius:inspectionFreeze.frozen?0:24');
 expect(frame).toContain('inspectionFreeze.record(frameMs)');
});
