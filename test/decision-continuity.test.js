import { test, expect } from 'bun:test';
import { canonicalId } from '../shared/causality/index.js';
import { readContinuity, recordContext, continuityLink, localContextId, decisionSnapshot, pairedSnapshot } from '../world/decision/continuity.js';
import { mappingForClause } from '../world/constitution-city/mappings.js';
import { buildDearCongressRevisionDraft } from '../world/dear-congress-feedback.js';
const base = { ...readContinuity('/'), entityId: canonicalId('building','osm','123') };
test('canonical decision context roundtrips and reopens only its native experiment', () => {
  const context = recordContext(base, { namespace:'decision',experimentId:'e_1',runId:'r_2',scenarioId:'s',branchId:'fork',tick:12 });
  const url = continuityLink('/world/decision.html?demo=1#advanced', context);
  expect(readContinuity(url)).toEqual(context);
  const query = new URL(url, 'http://localhost').searchParams;
  expect(query.get('experiment')).toBe('e_1'); expect(query.has('demo')).toBe(false);
  expect(query.get('run')).toBe('r_2'); expect(query.get('month')).toBe('12');
  expect(new URL(continuityLink('/world/experiment-lab.html',context),'http://localhost').searchParams.has('experiment')).toBe(false);
  expect(localContextId(context.experimentId,'experiment','civic')).toBeNull();
});
test('new experiment clears stale run/branch/time while retaining world/entity', () => {
 const old=recordContext(base,{namespace:'decision',experimentId:'old',runId:'run',branchId:'fork',tick:9});
 const next=recordContext(old,{namespace:'decision',experimentId:'new'});
 expect(next.runId).toBeUndefined();expect(next.branchId).toBeUndefined();expect(next.tick).toBeUndefined();
 expect(next.worldId).toBe(base.worldId);expect(next.entityId).toBe(base.entityId);
});
test('switching engines clears foreign experiment identity for an unsaved local catalog',()=>{
 const source=recordContext(base,{namespace:'decision',experimentId:'old',runId:'source'});
 const selected=recordContext(source,{namespace:'constitution',runId:'actual',tick:6});
 expect(selected.experimentId).toBeUndefined();expect(selected.runId).toBe('run:constitution:actual');
 const link=new URL(continuityLink('/world/decision.html?experiment=wrong&run=old&demo=1',selected),'http://localhost');
 expect(link.searchParams.has('experiment')).toBe(false);expect(link.searchParams.has('demo')).toBe(false);
});
test('invalid, duplicate and cross-origin navigation fails visibly',()=>{
 expect(()=>readContinuity('/?runId=local')).toThrow();expect(()=>readContinuity('/?tick=1&tick=2')).toThrow();
 expect(()=>continuityLink('https://elsewhere.test',base)).toThrow();
});
test('snapshots expose actual candidate Pareto records and never fabricate missing results',()=>{
 const job={id:'j',status:'completed',config:{objectives:[{metricId:'rent',direction:'minimize'}],constraints:[]},pareto:['c'],candidates:[{id:'c',feasible:true}]};
 const snapshot=decisionSnapshot({experiment:{modelVersion:'pinned',scenarios:[]},job});
 expect(snapshot.optimization.pareto).toEqual(['c']);expect(snapshot.model.version).toBe('pinned');expect(snapshot.worldMutation).toBe(false);
 expect(pairedSnapshot({}).results).toBeNull();
});
test('unsupported reviewed clause remains unmodeled and feedback retains origin context',()=>{
 expect(mappingForClause('mh_988').supported).toBe(false);expect(mappingForClause('made-up').supported).toBe(false);
 const draft=buildDearCongressRevisionDraft({experiment:{plan:{title:'Plan'}},improvement:{id:'change'},context:base});
 expect(draft.metadata.continuity).toEqual(base);expect(draft.metadata.generatedFromSimulation).toBe(true);
});
