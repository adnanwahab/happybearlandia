import { mountContinuity } from '../decision/continuity-view.js';
import { continuityLink, pairedSnapshot } from '../decision/continuity.js';
import {loadConstitutionSource,constitutionLocationQuery} from './source.js';
import {createCity,createCityFromArea} from '../city/seed.js';
import {createConstitutionRuntime} from './runtime.js';
import {mountConstitutionStudio} from './studio.js';
import {mountConstitutionCityView,constitutionCityLayout} from './views.js';
import {analyzeConstitutionDiff} from './analysis.js';
import {mountConstitutionEditor} from './editor.js';
import {LAW_CATALOG} from '../laws/catalog.js';
import {mountLawPanel} from '../laws/law-panel.js';
import {compareLawInWorker} from '../laws/comparison-client.js';
import {mountLawLibrary} from '../laws/library.js';
const continuity=mountContinuity();
function syncContinuity(value,plan){const m=value.result?.manifest;continuity.update(pairedSnapshot({...value,plan}),m?{namespace:'constitution',runId:value.runId,scenarioId:value.scenarioId,tick:value.month}:undefined);}
const query=constitutionLocationQuery(),status=document.querySelector('#cc-load-status'),container=document.querySelector('#cc-app'),refresh=document.querySelector('#cc-refresh-plan');
document.querySelector('#cc-return-world').href=continuity.getContext()?continuityLink('/world?'+query,continuity.getContext(),window.location.origin):'/world?'+query;

const seed=Number(query.get('seed')??42),location=query.has('lat')&&query.has('lng')?{lat:Number(query.get('lat')),lng:Number(query.get('lng'))}:{lat:29.7286,lng:-95.4746};
let generation=0,studio=null,runtime=null,disposed=false,initial=null,editor=null,lawLibrary=null,lawPanel=null;
const abort=new AbortController();
async function initialCity(){
 if(initial)return initial;const options={seed,households:30};let geometryNote='Three illustrative districts · 30 synthetic households.';
 if(location){
  try{
   const response=await fetch(`/api/area?lat=${location.lat}&lng=${location.lng}&radiusM=400&core=1`,{signal:AbortSignal.any([abort.signal,AbortSignal.timeout(12000)])});
   const area=await response.json();
   if(response.ok&&area.source==='osm'&&Array.isArray(area.buildings)){
    // Keep the forecast sample explicit and bounded; no real household inventory is inferred.
    const buildings=area.buildings.filter(b=>b.kind!=='park'&&Array.isArray(b.pts)&&b.pts.length>=3).sort((a,b)=>{
     const distance=row=>{const p=row.pts[0];return(p[0]-location.lat)**2+((p[1]-location.lng)*Math.cos(location.lat*Math.PI/180))**2;};return distance(a)-distance(b);
    }).slice(0,80);
    if(buildings.length){initial=createCityFromArea({...area,origin:area.origin||location,buildings},options);initial.provenance.assumptions.push(`Forecast sample: ${buildings.length} nearby mapped footprints and 30 synthetic households. This is separate from the daily /world population.`);geometryNote=`${location.lat.toFixed(4)}, ${location.lng.toFixed(4)} · ${buildings.length} mapped footprints · 30 synthetic households.`;}
   }
  }catch(error){geometryNote=`Map unavailable: ${error.name==='TimeoutError'?'request timed out':error.message}. Using three illustrative districts and 30 synthetic households.`;}
 }
 initial??=createCity(options);document.querySelector('#cc-location').textContent=geometryNote;return initial;
}
async function load(refreshSource=false){
 const token=++generation;refresh.disabled=true;status.textContent=refreshSource?'Refreshing the public Dear Congress source plan…':'Loading the source plan and city geography…';
 try{
  const [{plan,source},state]=await Promise.all([loadConstitutionSource({refresh:refreshSource,signal:abort.signal,packageId:new URLSearchParams(window.location.search).get('package')||undefined}),initialCity()]);
  if(disposed||token!==generation)return;
  if(refreshSource&&source.sourceMode!=='frozen-snapshot'){const url=new URL(window.location.href);if(url.searchParams.has('planId')){url.searchParams.set('planId',plan.id);history.replaceState(null,'',url);}}
  syncContinuity({},plan);
  studio?.destroy();runtime?.destroy();container.replaceChildren();runtime=createConstitutionRuntime({initial:state,plan});
  const views=[];
  studio=mountConstitutionStudio(container,{plan,runtime,initial:state,onStateChange:value=>syncContinuity(value,plan),createWorldView:(element,options)=>{const view=mountConstitutionCityView(element,options);views.push(view);return view;},analyzeDiff:analyzeConstitutionDiff,onError:error=>{status.textContent=`World Diff: ${error.message}`;}});
  window.hblConstitutionCity={plan,source,initial:state,runtime,studio,views};
  editor?.destroy();lawLibrary?.destroy();lawPanel?.destroy();
  editor=mountConstitutionEditor(document.querySelector('#cc-compiler'),{sourcePlan:plan,onCompile:async compiled=>{
   if(disposed)return;studio?.destroy();runtime?.destroy();container.replaceChildren();
   runtime=createConstitutionRuntime({initial:state,plan:compiled.plan});const amendedViews=[];
   studio=mountConstitutionStudio(container,{plan:compiled.plan,runtime,initial:state,onStateChange:value=>syncContinuity(value,compiled.plan),createWorldView:(element,options)=>{const view=mountConstitutionCityView(element,options);amendedViews.push(view);return view;},analyzeDiff:analyzeConstitutionDiff,onError:error=>{status.textContent=`World Diff: ${error.message}`;}});
   window.hblConstitutionCity={plan:compiled.plan,source,compilation:compiled,initial:state,runtime,studio,views:amendedViews,editor,lawLibrary,lawPanel};
   await studio.run();
  }});window.hblConstitutionCity.editor=editor;
  const lawContext=()=>{const layout=constitutionCityLayout(state);return{seed:state.seed,population:state.households.reduce((sum,household)=>sum+household.size,0),worldContext:{districts:state.districts.map(district=>({...district,...layout.districts.get(district.id)})),buildings:state.buildings.map(building=>({id:building.sourceId??building.id,kind:'home',districtId:building.districtId,center:layout.buildings.find(row=>row.id===building.id)?.center,geometry:building.geometry}))}};};
  lawPanel=mountLawPanel(document.body,{laws:LAW_CATALOG,getContext:lawContext,onPlanIdeaChange:text=>editor.setText(text),compareLaw:(law,context)=>compareLawInWorker({lawId:law.id,seed:context.seed,population:context.population,...(law.mapping?.engine==='population'?{minutes:1440,worldContext:context.worldContext}:{years:5,initialState:state}),implementationStrength:context.implementationStrength,signal:context.signal})});
  lawLibrary=mountLawLibrary(document.querySelector('#cc-law-library'),{laws:LAW_CATALOG,onSelect:law=>{editor.setText(law.text);lawPanel.open();lawPanel.selectLaw(law);}});
  window.hblConstitutionCity.lawLibrary=lawLibrary;window.hblConstitutionCity.lawPanel=lawPanel;refresh.textContent=source.sourceMode==='frozen-snapshot'?'Reload frozen source snapshot':'Refresh source plan';status.textContent='Select a clause, then evaluate paired futures. Views and analysis use the selected recorded seed and month. The daily resident world remains a separate simulation.';
 }catch(error){if(!disposed&&token===generation)status.textContent=`Could not load World Diff: ${error.message}. ${studio?'The previous source and results are retained.':'Retry with Refresh source plan.'}`;}
 finally{if(token===generation)refresh.disabled=false;}
}
refresh.addEventListener('click',()=>load(true));load();
addEventListener('pagehide',()=>{disposed=true;generation++;abort.abort();editor?.destroy();lawLibrary?.destroy();lawPanel?.destroy();studio?.destroy();runtime?.destroy();},{once:true});
