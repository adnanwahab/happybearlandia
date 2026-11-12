import {test,expect} from 'bun:test';
import {playbackFacts,mountPlaybackFacts,withMetadataDeadline} from '../world/onboarding/first-run-repairs.js';
import {formatOutcomeSummary,realityControlReason} from '../world/reality/outcome-feedback.js';
test('playback facts retain seed zero and never substitute missing mood with zero',()=>{
 expect(playbackFacts({mood:0,seed:0})).toBe('Mood: 0 / 100 · Seed: 0');
 expect(playbackFacts({mood:NaN,living:true})).toBe('Modeled utility: unavailable · Seed: unavailable');
});
test('compact facts mount outside collapsed settings and update only presentation',()=>{
 const toolbar={children:[],append(node){this.children.push(node);}};
 const doc={getElementById:id=>id==='world-quick-toolbar'?toolbar:null,createElement:()=>({style:{},setAttribute(){}})};
 const facts=mountPlaybackFacts(doc);facts.update({mood:67.5,seed:'42'});
 expect(toolbar.children).toHaveLength(1);expect(toolbar.children[0].textContent).toContain('68 / 100 · Seed: 42');
});
test('zero of one hundred passing is explained separately from execution errors',()=>{
 const text=formatOutcomeSummary({passed:0,failed:100,completed:100,requested:100,errors:0});
 expect(text).toContain('0/100 completed pairs passed all declared policy tests');expect(text).toContain('0 execution errors');expect(text).toContain('not a simulation error');
 expect(formatOutcomeSummary({completed:4,requested:5,unavailable:2,untested:1,errors:1})).toContain('4/5 requested pairs completed; 1 execution errors');
});
test('disabled compiler actions have prerequisite-specific reasons',()=>{
 expect(realityControlReason('run')).toContain('supported executable');
 expect(realityControlReason('fix')).toContain('nonpassing policy test');
 expect(realityControlReason('time')).toContain('Enter a completed future');
 expect(realityControlReason('cancel')).toContain('No operation');
 expect(realityControlReason('run',{busy:true})).toContain('cancel');
 expect(realityControlReason('run',{executable:true})).toBe('');
});

test('parameter disclosure completes or leaves loading with an explicit error',async()=>{
 expect(await withMetadataDeadline(Promise.resolve({status:'ready'}),20)).toEqual({status:'ready'});
 await expect(withMetadataDeadline(new Promise(()=>{}),5)).rejects.toThrow('Parameter provenance did not load');
});
