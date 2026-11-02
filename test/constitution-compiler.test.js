import {test,expect} from 'bun:test';
import {compileConstitution} from '../world/constitution-city/compiler.js';
import {applyClausePlan,normalizeDearCongressPlan} from '../world/constitution-city/plan.js';
import snapshot from '../world/constitution-city/dear-congress-plan.json';
import {createCity} from '../world/city/seed.js';
import {createEngine,cityMetrics} from '../world/city/engine.js';
test('exact text and source ranges survive CRLF, indentation, Unicode and explicit marker extraction',()=>{
 const text='  Article I · Rights\r\nRights: Equal access to public space.\r\nPower: Council may convene.\r\nInstitution: Public assembly\r\nProcedure: Open notice\r\nConstraint: Never infer a welfare score.\r\n\r\n[h_lots] Edited zoning proposal — 🌳\r\n';
 const result=compileConstitution(text);expect(result.sourceText).toBe(text);expect(result.plan.provenance.sourceText).toBe(text);
 for(const clause of result.clauses)expect(text.slice(clause.sourceRange.start,clause.sourceRange.end)).toBe(clause.sourceText);
 for(const category of['rights','powers','institutions','procedures','constraints']){expect(result[category].length).toBe(1);const row=result[category][0];expect(text.slice(row.sourceRange.start,row.sourceRange.end)).toBe(row.text);expect(row.legalDetermination).toBe(false);expect(row.implementedConstraint).toBe(false);}
 expect(result.clauses.find(c=>c.sourceId==='h_lots').supported).toBe(true);expect(result.diagnostics.some(d=>d.code==='EDITED_BOUND_SOURCE')).toBe(true);
});
test('only explicit unique reviewed IDs map; free text, unsupported and unknown domains never become housing',()=>{
 const result=compileConstitution('Reduce minimum lot sizes and parking mandates.\n\n[h_vouchers] Guarantee housing vouchers.\n[made_up] Build a fair society.\n[mh_988] Answer crisis calls.');
 expect(result.plan.clauses.every(c=>!c.supported)).toBe(true);const initial=createCity({households:3}),applied=applyClausePlan(initial,result.plan);expect(applied.policies).toEqual([]);expect(applied.finance).toEqual(initial.finance);
 expect(result.diagnostics.some(d=>d.code==='UNKNOWN_SOURCE_ID')).toBe(true);
 const duplicate=compileConstitution('[h_lots] One proposal\n[h_lots] Another proposal');expect(duplicate.plan.clauses.every(c=>!c.supported)).toBe(true);expect(new Set(duplicate.plan.clauses.map(c=>c.id)).size).toBe(2);expect(duplicate.diagnostics.filter(d=>d.code==='DUPLICATE_SOURCE_BINDING').length).toBe(2);
});
test('reviewed traces name actual mechanism, parameter and outcome wiring while leaving outcomes unevaluated',()=>{
 const result=compileConstitution('[h_lots] Permit homes.\n[f_drainage] Build drainage.\n[t_brt] Improve transit.');expect(result.plan.clauses.filter(c=>c.supported).map(c=>c.id)).toEqual(['h_lots','f_drainage','t_brt']);
 for(const clause of result.clauses){expect(clause.trace.parameters.some(p=>p.name==='addIntervention.amount')).toBe(true);expect(clause.trace.outcomes.every(o=>o.value===null&&o.status.includes('simulation'))).toBe(true);expect(clause.trace.chain.some(node=>node.kind==='mechanism')).toBe(true);}
 const original=createCity({households:3}),applied=applyClausePlan(original,result.plan),future=createEngine().run(applied,36).state;
 expect(future.parcels[0].capacity).toBe(original.parcels[0].capacity+4);expect(cityMetrics(future).completedProjects).toBeGreaterThan(0);expect(applied.finance).toEqual(original.finance);
});
test('edited prose and numbers do not become effect-size or cost overrides; compilation is deterministic',()=>{
 const result=compileConstitution('[h_lots] Add 9999999 homes for $1 with instant construction.');expect(result.plan.clauses[0].mapping.amount).toBe(4);expect(result.plan.clauses[0].costB).toBe(0);
 expect(result).toEqual(compileConstitution(result.sourceText));expect(result.plan.clauses[0].compiler.trace.outcomes.every(row=>row.value===null)).toBe(true);
});
test('source plans use the public allowlist and missing source/cost cannot fabricate a reviewed implementation',()=>{
 const source=normalizeDearCongressPlan(snapshot);source.journal='PRIVATE';source.clauses[0].author='PRIVATE';const result=compileConstitution('[h_lots] Explicit binding',{sourcePlan:source});expect(JSON.stringify(result)).not.toContain('PRIVATE');
 const restricted={...source,clauses:source.clauses.filter(c=>c.id!=='h_lots')};expect(compileConstitution('[h_lots] Explicit binding',{sourcePlan:restricted}).plan.clauses[0].supported).toBe(false);
 const missingCost=structuredClone(source);missingCost.clauses.find(c=>c.id==='h_lots').costB=null;expect(compileConstitution('[h_lots] Explicit binding',{sourcePlan:missingCost}).plan.clauses[0].supported).toBe(false);
});
test('empty and bounded-invalid inputs are explicit; no source clauses or marker content are silently truncated',()=>{
 expect(compileConstitution('').plan.clauses).toEqual([]);expect(compileConstitution('Rights:').diagnostics.some(row=>row.code==='EMPTY_FIELD_MARKER')).toBe(true);
 expect(()=>compileConstitution('x'.repeat(128001))).toThrow('128000');expect(()=>compileConstitution(Array.from({length:129},(_,i)=>`[unknown_${i}] Clause`).join('\n'))).toThrow('128');expect(()=>compileConstitution('Right: '+'x'.repeat(4001))).toThrow('4000');expect(()=>compileConstitution('x'.repeat(20001))).toThrow('20000');expect(()=>compileConstitution(null)).toThrow();
});
test('ordinary prose supplies all five lexical candidate groups without enabling any model intervention',()=>{
 const text='Every resident has the right to a home and is entitled to public space. Congress shall establish the Housing Agency. The Housing Agency may issue permits within 30 days, by a vote taken annually. The agency shall not deny access unless at least two members concur, and may not collect at most three fees before or after a hearing.';
 const result=compileConstitution(text);
 for(const category of['rights','powers','institutions','procedures','constraints']){expect(result[category].length).toBeGreaterThan(0);for(const row of result[category]){expect(row.interpretation).toBe('lexical candidate; not legal adjudication');expect(row.legalDetermination).toBe(false);expect(row.implementedConstraint).toBe(false);expect(text.slice(row.sourceRange.start,row.sourceRange.end)).toBe(row.text);expect(text.slice(row.extraction.cueRange.start,row.extraction.cueRange.end)).toBe(row.extraction.cue);}}
 expect(result.plan.clauses.every(clause=>!clause.supported)).toBe(true);expect(applyClausePlan(createCity({households:3}),result.plan).policies).toEqual([]);
});
test('lexical sentence spans preserve wrapped CRLF prose, decimal numbers and repeated source occurrences',()=>{
 const text='Article I\r\n🌳 Residents are guaranteed access.\r\nThe agency\r\nshall act within 12 days at a cost of 1.25 units.\r\nCongress may convene. Congress may convene.\r\n';
 const result=compileConstitution(text);expect(result.sourceText).toBe(text);
 const wrapped=result.procedures.find(row=>row.text.includes('within 12 days'));expect(wrapped.text).toBe('The agency\r\nshall act within 12 days at a cost of 1.25 units.');expect(wrapped.sourceRange.line).toBe(3);expect(wrapped.sourceRange.endLine).toBe(4);
 const repeated=result.powers.filter(row=>row.text==='Congress may convene.');expect(repeated.length).toBe(2);expect(repeated[0].sourceRange.start).not.toBe(repeated[1].sourceRange.start);
 for(const category of['rights','powers','institutions','procedures','constraints'])for(const row of result[category])expect(text.slice(row.sourceRange.start,row.sourceRange.end)).toBe(row.text);
});
test('explicit markers retain their category without duplicate lexical candidates and bindings still require source IDs',()=>{
 const result=compileConstitution('Rights: Congress shall guarantee the right to housing within 30 days.\n\n[h_lots] Congress may permit at least 900000 homes annually.');
 expect(result.rights.length).toBe(1);expect(result.rights[0].extraction.method).toBe('explicit-marker');expect(result.powers.every(row=>row.clauseId==='h_lots')).toBe(true);
 expect(result.plan.clauses.filter(row=>row.supported).map(row=>row.id)).toEqual(['h_lots']);expect(result.plan.clauses.find(row=>row.id==='h_lots').mapping.amount).toBe(4);
 const neutral=compileConstitution('A sunny square has trees and benches.');for(const category of['rights','powers','institutions','procedures','constraints'])expect(neutral[category]).toEqual([]);
 expect(()=>compileConstitution('Congress may convene. '.repeat(129))).toThrow('128 lexical candidates');
});
