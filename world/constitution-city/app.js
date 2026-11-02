import {loadConstitutionSource,constitutionLocationQuery} from './source.js';
import {createCity,createCityFromArea} from '../city/seed.js';
import {createConstitutionRuntime} from './runtime.js';
import {mountConstitutionStudio} from './studio.js';
import {mountConstitutionCityView} from './views.js';
import {analyzeConstitutionDiff} from './analysis.js';
const query=constitutionLocationQuery(),status=document.querySelector('#cc-load-status'),container=document.querySelector('#cc-app'),refresh=document.querySelector('#cc-refresh-plan');
document.querySelector('#cc-return-world').href='/world'+(query.size?'?'+query:'');
const seed=Number(query.get('seed')??42),location=query.has('lat')&&query.has('lng')?{lat:Number(query.get('lat')),lng:Number(query.get('lng'))}:null;
let generation=0,studio=null,runtime=null,disposed=false,initial=null;
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
  studio?.destroy();runtime?.destroy();container.replaceChildren();runtime=createConstitutionRuntime({initial:state,plan});
  studio=mountConstitutionStudio(container,{plan,runtime,initial:state,createWorldView:mountConstitutionCityView,analyzeDiff:analyzeConstitutionDiff,onError:error=>{status.textContent=`World Diff: ${error.message}`;}});
  window.hblConstitutionCity={plan,source,initial:state,runtime,studio};status.textContent='Select a clause, then evaluate paired futures. Views and analysis use the selected recorded seed and month. The daily resident world remains a separate simulation.';
 }catch(error){if(!disposed&&token===generation)status.textContent=`Could not load World Diff: ${error.message}. ${studio?'The previous source and results are retained.':'Retry with Refresh source plan.'}`;}
 finally{if(token===generation)refresh.disabled=false;}
}
refresh.addEventListener('click',()=>load(true));load();
addEventListener('pagehide',()=>{disposed=true;generation++;abort.abort();studio?.destroy();runtime?.destroy();},{once:true});
