import {test,expect} from 'bun:test';
import fixture from './fixtures/truth-lens/representative.json';
import {truthPresentation,inspectedTruth,TRUTH_CATEGORIES} from '../world/truth-lens.js';
test('classification requires a recognized category and a source; confidence never promotes evidence',()=>{
 for(const record of [null,{}, {category:'observed'}, {category:'invented',source:'x'},{type:'observed',confidence:1}])expect(truthPresentation(record).category).toBe('unknown');
 for(const category of Object.keys(TRUTH_CATEGORIES))expect(truthPresentation({category,source:'explicit source'}).category).toBe(category);
 expect(truthPresentation({category:'synthetic',source:'seeded'}).category).toBe('assumed');
});
test('mixed building classifications preserve exact geometry identity, missing evidence and input immutability',()=>{
 const before=structuredClone(fixture);
 const rows=inspectedTruth({type:'building',...fixture});
 expect(rows.find(x=>x.field==='Footprint geometry').category).toBe('observed');
 expect(rows.find(x=>x.category==='decorative')).toBeDefined();
 expect(rows.find(x=>x.category==='modeled').source).toContain('not a census');
 expect(inspectedTruth({type:'building',area:fixture.area,buildingId:'other'}).find(x=>x.field==='Footprint geometry').category).toBe('unknown');
 expect(inspectedTruth({type:'building',area:{...fixture.area,source:'cache'},buildingId:fixture.buildingId}).find(x=>x.field==='Footprint geometry').category).toBe('unknown');
 expect(inspectedTruth({type:'person'}).some(x=>x.category==='assumed')).toBe(true);
 expect(inspectedTruth({type:'building',...fixture})).toEqual(rows);expect(fixture).toEqual(before);
});
