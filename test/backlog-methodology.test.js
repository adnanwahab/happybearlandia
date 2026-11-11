import {test,expect} from 'bun:test';
import {methodologyReport,mountMethodology} from '../world/decision/backlog-methodology/report.js';
import {runPublishedHousingDiagnostic} from '../world/decision/backtest.js';
test('preserves actual diagnostic sources and uncertainty',async()=>{const r=await runPublishedHousingDiagnostic({runs:3,seed:72});const p=methodologyReport(r);expect(p.kind).toBe('Retrospective diagnostic');expect(p.sources.length).toBe(2);expect(p.seed).toBe(72);expect(p.empiricalDefaultValidated).toBe(false);expect(p.holdout.count).toBeNull();expect(p.metrics).toEqual(r.metrics);});
test('escapes data and retains missing metadata',()=>{const el={};const p=mountMethodology(el,{metrics:[],parameters:{x:'<script>'}});expect(el.innerHTML).not.toContain('<script>');expect(p.modelVersion).toBeNull();expect(()=>methodologyReport({})).toThrow();});
import {createHousingHistoryAdapter,runHistoricalBacktest} from '../world/decision/backtest.js';
import {serializeMethodology} from '../world/decision/backlog-methodology/report.js';
test('uploaded synthetic calibration retains fit audit and isolates changed holdout',async()=>{
 const raw=[2010,2012,2020].map((year,i)=>({year,metricId:'median_rent',value:1000+i*100,unit:'USD/month',geography:'synthetic-city',availableAt:`${year+1}-01-01`,dollarYear:2010}));
 const run=async rows=>runHistoricalBacktest({adapter:await createHousingHistoryAdapter(rows,{synthetic:true,baseYear:2010}),cutoff:'2015-01-01',targetDate:'2020-01-01',runs:2,simulate:({parameters})=>({metrics:{median_rent:parameters.initial_rent}})});
 const first=await run(raw), second=await run(raw.map(r=>r.year===2020?{...r,value:8000}:r));
 const report=methodologyReport(first);
 expect(report.fit.audit.candidates.length).toBeGreaterThan(0);expect(report.fit.count).toBe(2);expect(report.holdout.count).toBe(1);expect(second.parameters).toEqual(first.parameters);expect(second.metrics[0].observed).toBe(8000);expect(JSON.parse(serializeMethodology(first))).toEqual(JSON.parse(JSON.stringify(report)));
});
test('flags temporal overlap, absent units and nonfinite partial scoring without inventing coverage',()=>{
 const report=methodologyReport({metrics:[{metricId:'unknown',observed:NaN,predictedMean:3}],targetDate:'2020-01-01',cutoff:'2021-01-01'});
 expect(report.evidence.temporalStatus).toContain('retrospective');expect(report.evidence.warnings.length).toBe(2);expect(report.metrics[0].covered80).toBeUndefined();expect(report.evidence.calibrationMetadata).toBe('Unavailable');
});
test('uploaded unit and geography mismatch rejected by actual adapter',async()=>{
 const row={year:2010,metricId:'median_rent',value:1000,unit:'homes',geography:'synthetic',availableAt:'2011-01-01'};
 await expect(createHousingHistoryAdapter([row],{synthetic:true})).rejects.toThrow();
});
