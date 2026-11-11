import {test,expect} from 'bun:test';
import {constructionFrame,forkFrame} from '../world/decision/backlog-presentation-effects/index.js';
const parent={projects:[{projectId:'p',states:[{month:0,progress:0,floorsBuilt:0,completedUnits:0},{month:2,progress:1,floorsBuilt:4,completedUnits:20}]}]};
test('visual interpolation never advances recorded outcomes',()=>{const f=constructionFrame(parent,'p',1);expect(f.visual.floorsBuilt).toBe(2);expect(f.recorded.completedUnits).toBe(0);expect(parent.projects[0].states[0].floorsBuilt).toBe(0)});
test('missing records and reverse scrub',()=>{expect(constructionFrame(parent,'missing',1).recorded).toBeNull();expect(constructionFrame(parent,'p',2).recorded.completedUnits).toBe(20);expect(constructionFrame(parent,'p',0).visual.floorsBuilt).toBe(0);expect(()=>constructionFrame(parent,'p',NaN)).toThrow()});
test('fork prefix fixed to parent',()=>{expect(forkFrame({parent,fork:{},forkMonth:1,month:1,projectId:'p'}).branch.recorded.month).toBe(0);expect(forkFrame({parent,fork:{},forkMonth:1,month:2,projectId:'p'}).branch.recorded).toBeNull()});
