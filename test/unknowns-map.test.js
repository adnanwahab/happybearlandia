import {test,expect} from 'bun:test';
import {inspectCoverage} from '../world/unknowns/map.js';
import fixture from '../world/unknowns/fixture.json';
test('deterministic metadata distinguishes absent cells from explicit missing and unsupported records',()=>{
 expect(inspectCoverage(fixture,fixture.scope,'building:a','observed sources').state).toBe('available');
 expect(inspectCoverage(fixture,fixture.scope,'building:a','computed model effects').state).toBe('missing');
 expect(inspectCoverage(fixture,fixture.scope,'building:b','unsupported behaviors').state).toBe('unsupported');
 const absent=inspectCoverage(fixture,fixture.scope,'building:c','observed sources');expect(absent.state).toBe('unknown');expect(absent).not.toHaveProperty('value');
 expect(inspectCoverage(structuredClone(fixture),fixture.scope,'building:c','observed sources')).toEqual(absent);
});
test('foreign scope, schema, duplicate records and incomplete provenance fail closed',()=>{
 for(const metadata of [null,{...fixture,schemaVersion:'future'}, {...fixture,scope:'foreign'}, {...fixture,cells:[null,{},0]}, {...fixture,cells:[fixture.cells[0],fixture.cells[0]]}, {...fixture,cells:[{...fixture.cells[0],evidence:''}]}])expect(inspectCoverage(metadata,fixture.scope,'building:a','observed sources').state).toBe('unknown');
});

test('normal World entry mounts the read-only panel and disposes on page exit',async()=>{
 const source=await Bun.file('world/render.js').text();
 expect(source).toContain("import {mountUnknowns} from './unknowns/map.js'");
 expect(source).toContain("mountUnknowns({container:$('top')");
 expect(source).toContain("entities:town.buildings.map(b=>({id:String(b.id)})),metadata:null");
 expect(source).toContain("addEventListener('pagehide',()=>unknownsMap?.destroy(),{once:true})");
});
