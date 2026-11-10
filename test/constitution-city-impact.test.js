import {test,expect} from 'bun:test';
import {studioImpactState} from '../world/constitution-city/impact.js';
import {buildLawImpact} from '../world/laws/impact.js';
import {createCity} from '../world/city/seed.js';
import {analyzeConstitutionDiff} from '../world/constitution-city/analysis.js';

const plan={clauses:[{id:'h_lots',authority:'Housing office'},{id:'f_drainage',authority:'Public works'}]},scenario={id:'proposal-a',label:'Proposal A',clauseIds:['h_lots']};
test('package impacts use exact building, parcel and unit joins and retain the complete-package attribution',()=>{
 const baseline=createCity({seed:42,households:4}),state=structuredClone(baseline);state.parcels[0].capacity+=2;state.households[0].savings+=100;
 const analysis=analyzeConstitutionDiff({baseline,current:state}),input={plan,selected:{state,baselineState:baseline},analysis,scenarioId:scenario.id,scenario},before=JSON.stringify(input);
 const adapted=studioImpactState(input),report=buildLawImpact({...adapted,building:adapted.buildings.find(b=>b.id===state.buildings.find(b=>b.parcelId===state.parcels[0].id)?.id)});
 expect(adapted.law.institutions).toEqual(['Housing office']);expect(report.title).toContain('Full evaluated package');expect(report.title).toContain('not isolated effects');expect(report.completed).toBe(true);
 expect(adapted.result.visual.recordedBuildingIds.sort()).toEqual(state.buildings.filter(b=>b.parcelId===state.parcels[0].id).map(b=>b.id).sort());
 expect(report.groups.find(row=>row.id==='winners').count).toBe(1);expect(report.profile.cost).toContain('parking');expect(report.profile.benefit).not.toContain('flood');expect(JSON.stringify(input)).toBe(before);
});
test('initial state and mismatched replay never generate a distribution or measured effects',()=>{
 const pending=studioImpactState({plan});expect(pending.result).toBeNull();
 const baseline=createCity({seed:42,households:4}),state=structuredClone(baseline);state.month++;
 const analysis=analyzeConstitutionDiff({baseline,current:state}),report=buildLawImpact(studioImpactState({plan,selected:{state,baselineState:baseline},analysis,scenarioId:'proposal-a',scenario}));
 expect(report.completed).toBe(false);expect(report.groups).toEqual([]);expect(report.metrics).toEqual([]);
});
