import {describe,test,expect} from 'bun:test';
import {createPopulationModel,stepPopulation,serializePopulation} from '../world/population/model.js';
import {modeAlternatives,eventEffects} from '../world/population/behavior.js';
import {peopleBenchmarkContext} from '../world/bench/people-context.js';
import {attachTransportExperiment,beginTransportInterval,transportRead,transportPermutation,TRANSPORT_ARMS} from '../world/population/transport-experiment.js';
import {runTransportArm,normalizeExperiment,summarizeExperiment,stateDigest} from '../world/research/interaction-ablation.js';
import {pairedSeedBand} from '../world/research/paired-seeds.js';
import {createTransportObserver} from '../world/research/transport-graph.js';
const make=()=>createPopulationModel({population:100,seed:42},peopleBenchmarkContext());
describe('transport interaction experiment',()=>{
 test('full attachment preserves exact ordinary production state',()=>{
  const ordinary=make(),full=make();attachTransportExperiment(full,'full',createTransportObserver(100));
  for(let tick=1;tick<=24;tick++){stepPopulation(ordinary,{tick,minutes:60});stepPopulation(full,{tick,minutes:60});}
  expect(serializePopulation(full)).toEqual(serializePopulation(ordinary));
 });
 test('all arms replay deterministically from identical identities and initial state',()=>{
  const results=TRANSPORT_ARMS.map(arm=>runTransportArm({population:100,seed:42,days:1,arm}));
  expect(new Set(results.map(r=>r.initialDigest)).size).toBe(1);
  for(const row of results)expect(runTransportArm({population:100,seed:42,days:1,arm:row.arm})).toEqual(row);
  expect(results[0].clock.finalMinute).toBe(1440);
 });
 test('frozen reads cannot receive lagged congestion or within-step boarding demand',()=>{
  const m=make();attachTransportExperiment(m,'frozen-transport');
  const initial=modeAlternatives(m,0,1,eventEffects(m,0),[1800,0]);
  m.districts[1].congestion=5;m.districts[1].transitCrowding=20;m.districts[1].transitDemand=900;
  expect(modeAlternatives(m,0,1,eventEffects(m,0),[1800,0])).toEqual(initial);
  expect(transportRead(m,1,'transitDemand')).toBe(0);
  expect(transportRead(m,1,'congestion')).toBe(1);
 });
 test('half/double scale feedback rather than outcomes or physical capacities',()=>{
  for(const [arm,factor]of [['half-transport',.5],['double-transport',2]]){
   const m=make();attachTransportExperiment(m,arm);m.districts[1].congestion=3;m.districts[1].transitDemand=100;
   expect(transportRead(m,1,'congestion')).toBe(1+2*factor);
   expect(transportRead(m,1,'transitDemand')).toBe(100*factor);expect(m.config.roadCapacity).toBe(800);
  }
 });
 test('shuffled feedback preserves exact multiset and is deterministic',()=>{
  const m=make();attachTransportExperiment(m,'shuffled-transport');
  m.districts[0].transitDemand=13;m.districts[1].transitDemand=47;
  for(let minute=0;minute<120;minute+=15){beginTransportInterval(m,minute);expect([0,1].map(d=>transportRead(m,d,'transitDemand')).sort((a,b)=>a-b)).toEqual([13,47]);}
  expect(transportPermutation(20,42,15)).toEqual(transportPermutation(20,42,15));
  expect(new Set(transportPermutation(20,42,15)).size).toBe(20);
  expect(transportPermutation(20,42,15)).not.toEqual(transportPermutation(20,43,15));
 });
 test('small known incidence graph includes isolates without claiming pairs/shards',()=>{
  const observer=createTransportObserver(4),model={prefix:'p',districts:[{id:'d'}],people:{remaining:[1,1,0,1],mode:[3,3,0,4],to:[0,0,0,0]}};
  observer.interval(model,0,15);const {graph,commute}=observer.result();
  expect(graph.incidences).toBe(3);expect(graph.resourceEpisodeNodes).toBe(2);expect(graph.meanDegree).toBe(1);
  expect(graph.giantComponentResidentShare).toBe(.5);expect(graph.crossShardShare).toBeNull();expect(commute.meanMinutes).toBeNull();
  observer.departure(model,0,{activity:1},{minutes:12});observer.departure(model,1,{activity:5},{minutes:500});
  expect(observer.result().commute).toEqual({meanMinutes:12,departures:1,unit:'planned minutes per work-bound departure'});
 });
 test('Student-t seed band uses paired differences and does not treat missing as zero',()=>{
  const pairs=[1,2,3,4,5].map(seed=>({seed,full:seed,control:0})),band=pairedSeedBand(pairs);
  expect(band.meanDifference).toBe(3);expect(band.interval95[0]).toBeCloseTo(1.03675684,6);expect(band.excludesZero).toBe(true);
  expect(pairedSeedBand(pairs.map(p=>({...p,control:p.full})) ).excludesZero).toBe(false);
  expect(pairedSeedBand([{seed:1,full:20,control:0}]).status).toBe('unavailable');
  expect(pairedSeedBand(pairs.map(p=>p.seed===3?{...p,full:null}:p)).missingSeeds).toEqual([3]);
  expect(()=>pairedSeedBand([pairs[0],pairs[0]])).toThrow('Unique');
 });
 test('manifest validates complete seed matching; transport significance cannot authorize E2',()=>{
  const settings={populations:[100],seeds:[1,2,3],days:1};
  const runs=settings.seeds.flatMap(seed=>TRANSPORT_ARMS.map(arm=>({population:100,seed,days:1,arm,initialDigest:'a'.repeat(64),modelVersion:'1.3.0',outcomes:{commuteMinutes:arm==='full'?10:0,employmentRate:arm==='full'?.75:.5,occupancy:.9,monthlyRent:1000}})));
  const summary=summarizeExperiment(settings,runs);expect(summary.comparisons[0].transportOnlyStatisticalCriterion).toBe(true);expect(summary.comparisons[0].e2Pass).toBe(false);expect(summary.coverage.completeNoInteraction).toBe(false);
  expect(()=>summarizeExperiment(settings,runs.slice(1))).toThrow('Missing');
  expect(()=>summarizeExperiment(settings,[...runs.slice(1),runs[1]])).toThrow('duplicate');
  expect(()=>summarizeExperiment(settings,runs.map((r,i)=>i===0?{...r,initialDigest:'b'.repeat(64)}:r))).toThrow('initial states');
  expect(()=>summarizeExperiment(settings,runs.map((r,i)=>i===0?{...r,outcomes:{...r.outcomes,occupancy:Infinity}}:r))).toThrow('outcome');
 });
 test('bounded settings and fresh-only attachments fail closed',()=>{
  for(const input of [{populations:[100001]},{seeds:[42,42]},{days:0},{days:1.5},{seeds:[-1]},{seeds:[2**32]},{extra:true}])expect(()=>normalizeExperiment(input)).toThrow();
  expect(()=>attachTransportExperiment(make(),'no-interaction')).toThrow();
  const m=make();stepPopulation(m,{minutes:15});expect(()=>attachTransportExperiment(m,'full')).toThrow('fresh');
 });
 test('state digest observes typed bytes, object values and reference structure',()=>{
  expect(stateDigest({a:new Uint8Array([1,2])})).not.toBe(stateDigest({a:new Uint8Array([1,3])}));
  const x={n:1};expect(stateDigest({a:x,b:x})).not.toBe(stateDigest({a:{n:1},b:{n:1}}));
 });
});

test('real CLI publishes a complete report and rejects invalid inputs without replacing it',()=>{
 const {mkdtempSync,readFileSync,rmSync}=require('node:fs'),{tmpdir}=require('node:os'),{join}=require('node:path');
 const dir=mkdtempSync(join(tmpdir(),'hbl-ablation-cli-')),output=join(dir,'report.json');
 try{
  const script=new URL('../scripts/benchmark-interaction-ablation.js',import.meta.url).pathname;
  const run=Bun.spawnSync([process.execPath,script,'10','1,2,3','1',output]);expect(run.exitCode).toBe(0);
  const bytes=readFileSync(output),report=JSON.parse(bytes);expect(report.runs.length).toBe(15);expect(report.comparisons[0].e2Pass).toBe(false);
  expect(Object.keys(report.sourceHashes).length).toBeGreaterThan(10);
  const invalid=Bun.spawnSync([process.execPath,script,'100001','1,2,3','1',output]);expect(invalid.exitCode).not.toBe(0);expect(readFileSync(output)).toEqual(bytes);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
