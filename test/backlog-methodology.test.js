import {test,expect} from 'bun:test';
import {methodologyReport,mountMethodology} from '../world/decision/backlog-methodology/report.js';
import {runPublishedHousingDiagnostic} from '../world/decision/backtest.js';
test('preserves actual diagnostic sources and uncertainty',async()=>{const r=await runPublishedHousingDiagnostic({runs:3,seed:72});const p=methodologyReport(r);expect(p.kind).toBe('Retrospective diagnostic');expect(p.sources.length).toBe(2);expect(p.seed).toBe(72);expect(p.empiricalDefaultValidated).toBe(false);expect(p.holdout.count).toBeNull();expect(p.metrics).toEqual(r.metrics);});
test('escapes data and retains missing metadata',()=>{const el={};const p=mountMethodology(el,{metrics:[],parameters:{x:'<script>'}});expect(el.innerHTML).not.toContain('<script>');expect(p.modelVersion).toBeNull();expect(()=>methodologyReport({})).toThrow();});
