import {loadRealityInitial} from './geography.js';
import {compileRealityProposal} from './compiler.js';
import {createRealityRuntime} from './runtime.js';
import {createRealityBranchStore} from './branches.js';
import {mountRealityStudio} from './studio.js';
import {mountRealityObservations} from './observation-panel.js';
import {publishRealityComparison} from './comparison-channel.js';
import {mountCitySpeaks} from '../city-speaks/panel.js';
const query=new URLSearchParams(location.search),status=document.querySelector('#reality-status'),abort=new AbortController();
const seed=query.has('seed')?Number(query.get('seed')):42,lat=query.has('lat')?Number(query.get('lat')):29.7286,lng=query.has('lng')?Number(query.get('lng')):-95.4746;
const locationQuery=new URLSearchParams({lat:String(lat),lng:String(lng),seed:String(seed)});document.querySelector('#reality-return').href='/world?'+locationQuery;document.querySelector('#reality-constitution').href='/visualize-constitution?'+locationQuery;
let studio=null,runtime=null,citySpeaks=null,observations=null,disposed=false,currentComparison=null;
async function searchCompromises(){
 if(!currentComparison)throw new Error('Enter an actual future first');
 const reference=currentComparison,state=studio.getState(),catalog=state.result?.manifest.id===reference.manifestId?state.result:{manifest:reference.manifest,runs:[reference]};
 const policyIds=new Set((reference.program.assumptions??[]).map(row=>row.id));
 if(!policyIds.size)throw new Error('This program has no adjustable policy assumptions. Add a reviewed mechanism, such as service expansion, before searching revisions.');
 status.textContent='Evaluating bounded policy revisions using actual paired reruns and the same selected seed…';
 const modelAnalysis=await runtime.challengeResult({result:catalog,metric:catalog.manifest.engine==='city'?'medianRent':'meanExperiencedTravelMinutes',runs:reference.runIndex+1});
 const module=await import('../city-speaks/analysis.js'),referenceAnalysis=module.analyzeCitySpeaks(reference),candidates=[];
 for(const evaluation of modelAnalysis.evaluations.filter(row=>policyIds.has(row.assumptionId))){
  const row=evaluation.result.runs.find(item=>item.runIndex===reference.runIndex&&item.status==='completed');if(!row)continue;
  const replay=await runtime.enterFuture({runId:row.runId,result:evaluation.result});
  const comparison={...replay,worldContext:reference.worldContext,program:evaluation.result.manifest.program,manifest:evaluation.result.manifest};
  const ranked=module.rankCitySpeaksCompromises([comparison],{reference})[0],input=reference.manifest.assumptions.find(a=>a.id===evaluation.assumptionId),base=reference.assumptions[evaluation.assumptionId];
  candidates.push({id:evaluation.id,label:evaluation.assumptionId+' = '+evaluation.value,status:'completed',result:evaluation.result,runId:row.runId,comparison,analysis:ranked.analysis,supportChange:ranked.supportChange,normalizedInputChange:input&&input.max>input.min?Math.abs(evaluation.value-base)/(input.max-input.min):null,summary:(ranked.supportChange===null?'Panel identity differs; support change unavailable.':String(ranked.supportChange)+' changed modeled supporter count using the same matched panel.')+' Actual rerun; no empirical polling claim.'});
 }
 candidates.sort((a,b)=>(b.supportChange??-Infinity)-(a.supportChange??-Infinity)||(a.normalizedInputChange??Infinity)-(b.normalizedInputChange??Infinity));
 await citySpeaks.update({comparison:reference,citySpeaks:{...referenceAnalysis,compromises:candidates}});status.textContent='Completed '+candidates.length+' actual single-assumption candidate comparisons. Inspect their recorded support changes; no improvement is guaranteed.';return candidates;
}

try{
 let geography;const regionId=query.get('regionFork');if(regionId){const raw=localStorage.getItem('hbl-reality-region:'+regionId);if(!raw||raw.length>1000000)throw new Error('This regional fork is absent from this browser or exceeds its data budget');const fork=JSON.parse(raw);if(fork.schemaVersion!=='reality-region.v1'||fork.id!==regionId)throw new Error('Invalid regional fork identity');geography={...fork,note:fork.manifest?.assumptions?.join(' · ')??'Painted closed-region fork; outside interactions excluded.',population:fork.initial.households.reduce((s,h)=>s+h.size,0)};}
 else geography=await loadRealityInitial({seed,lat,lng,signal:abort.signal});
 if(disposed)throw new Error('Page closed');const {initial,worldContext,note,population}=geography;document.querySelector('#reality-location').textContent=note;
 const proposal=geography.program?.sourceText??geography.manifest?.policyText??'Make housing affordable without raising taxes. Build affordable homes and speed up permits.';
 const program=geography.program??compileRealityProposal(proposal),branchStore=createRealityBranchStore({initial,program,key:`hbl-reality-branches-v1:${lat}:${lng}:${seed}:${regionId??'full'}`});
 const actualRuntime=createRealityRuntime({initial,worldContext});runtime={...actualRuntime,run:options=>actualRuntime.run({...options,...(options.program.engine==='population'?{populationConfig:{population,seed:initial.seed,householdSize:population/initial.households.length}}:{})})};
 let analyzer=null;const analyzerReady=import('../city-speaks/analysis.js').then(module=>{analyzer=module.analyzeCitySpeaks??module.analyzeCityComparison??module.default;if(typeof analyzer!=='function')throw new Error('City Speaks analysis API unavailable');return analyzer;});analyzerReady.catch(error=>{status.textContent='Reality Compiler ready; City Speaks analysis unavailable: '+error.message;});
 citySpeaks=mountCitySpeaks(document.querySelector('#city-speaks'),{getComparison:()=>currentComparison,analyze:async value=>(await analyzerReady)(value),onFocus:focus=>{if(studio.focusEntity({record:focus}))document.querySelector('[data-r-before]').scrollIntoView({behavior:'smooth',block:'center'});},onPerspective:({entity})=>{status.textContent='Recorded perspective · '+entity.id+' · inspect paired resources and retained history in The City Speaks.';},onRevise:async request=>{if(request.type==='inspect'&&request.candidate.result)return studio.enterFuture(request.candidate.runId,request.candidate.result);if(request.type==='search')return searchCompromises();if(request.type==='adopt'&&request.candidate.result){const manifest=request.candidate.result.manifest,parent=branchStore.getSelected();branchStore.fork(parent.id,{program:{...manifest.program,reviewedScenarioOverrides:manifest.assumptionOverrides},label:'Compromise revision'});studio.setProgram(branchStore.getSelected().program);return studio.run({assumptionOverrides:manifest.assumptionOverrides});}},onError:error=>{status.textContent=error.message;}});
 studio=mountRealityStudio(document.querySelector('#reality-app'),{initial,worldContext,runtime,branchStore,onComparison:({replay,result,program,views,entity})=>{if(!replay)return;publishRealityComparison(replay,worldContext);currentComparison={...replay,worldContext,program,manifest:result.manifest,baselineState:replay.baseline.snapshot??replay.baseline.state,currentState:replay.treatment.snapshot??replay.treatment.state};citySpeaks.update({comparison:currentComparison}).then(()=>{if(entity)citySpeaks.selectEntity(entity.id);});observations?.refresh();},onError:error=>{status.textContent='Reality Compiler: '+error.message;}});
 observations=mountRealityObservations(studio.getObservationContainer(),{getState:studio.getState,getScope:()=>initial.provenance.datasetVersion??'synthetic-city',onReview:async candidate=>{const parent=branchStore.getSelected();branchStore.fork(parent.id,{program:{...parent.program,reviewedScenarioOverrides:candidate.assumptionOverrides},label:'Reviewed observation revision'});studio.setProgram(branchStore.getSelected().program);await studio.run({assumptionOverrides:candidate.assumptionOverrides});},storageKey:'hbl-reality-observations:'+branchStore.initialId});
 window.hblRealityCompiler={studio,runtime,branchStore,citySpeaks,observations,initial,worldContext,getComparison:()=>currentComparison};status.textContent='Ready. Compile a proposal, review its actual model inputs, then evaluate paired futures. Enter success or failure worlds to inspect who changes.';
}catch(error){status.textContent='Could not open Reality Compiler: '+error.message;}
addEventListener('pagehide',()=>{disposed=true;abort.abort();observations?.destroy();citySpeaks?.destroy();studio?.destroy();runtime?.destroy();},{once:true});
