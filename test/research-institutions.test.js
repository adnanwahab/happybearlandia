import { describe, test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { INSTITUTIONS, getInstitution, contentHash, createExperimentRecord, assertCityEffectAllowed } from '../world/research/institutions.js';
import { getExperience } from '../world/universe/registry.js';
import { contextFromURL, contextURL } from '../world/universe/navigation.js';
const context=contextFromURL('http://localhost/?experimentId=experiment:research:one&runId=run:research:two&branchId=branch:research:fork&tick=40&entityId=building:hbl:lab');
describe('research institution integration',()=>{
 test('exact nine canonical registry facilities with installed standalone hooks',async()=>{
 expect(INSTITUTIONS).toHaveLength(9);expect(new Set(INSTITUTIONS.map(x=>x.id)).size).toBe(9);
 for(const facility of INSTITUTIONS){const app=getExperience(facility.appId);expect(app).toBeDefined();let path=app.route;if(path==='/tools/security-viz-lab')path+='.html';else if(path.endsWith('/'))path+='index.html';const html=await readFile('.'+path,'utf8');expect(html).toContain(`data-research-app="${app.id}"`);expect(facility.cityEffects).toBe(false);}
 });
 test('context survives each standalone route and return',()=>{for(const facility of INSTITUTIONS){const target=contextURL(getExperience(facility.appId).route,context);expect(contextFromURL(target)).toEqual(context);expect(contextFromURL(contextURL('/world',contextFromURL(target)))).toEqual(context);}});
 test('hash is stable across object key order and changes with inputs',async()=>{expect(await contentHash({b:2,a:1})).toBe(await contentHash({a:1,b:2}));expect(await contentHash({a:2})).not.toBe(await contentHash({a:1}));});
 test('record preserves provenance without implying validated experiment or city authority',async()=>{const record=await createExperimentRecord({appId:'monte-carlo',context,seed:42,backend:'CPU',inputs:{samples:256},outputs:{estimate:'3.14'},modelHash:await contentHash('source')});expect(record.context).toEqual(context);expect(record.kind).toBe('display-snapshot');expect(record.inputHash).toMatch(/^sha256:/);expect(record.cityEffects).toBe(false);expect(record.validation).toBe('not independently validated');expect(()=>assertCityEffectAllowed(record)).toThrow('no validated explicit city adapter');});
 test('reject unknown facilities, invalid seeds, missing source hashes and malformed context',async()=>{const base={appId:'climate',context,seed:42,backend:'WebGPU',inputs:{},outputs:{},modelHash:await contentHash('model')};for(const patch of [{appId:'blog'},{seed:NaN},{backend:'fabricated'},{modelHash:'none'},{context:{worldId:'local'}}])await expect(createExperimentRecord({...base,...patch})).rejects.toThrow();expect(getInstitution('twitch')).toBeUndefined();});
});
