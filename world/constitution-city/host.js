import {constitutionLocationQuery,loadConstitutionSource} from './source.js';
/** Lightweight clause scope on the original world. Forecasts run in the paired lab. */
export function mountConstitutionWorldHost({THREE,scene,town,camera,controls,container=document.body}={}){
 const doc=container.ownerDocument,root=doc.createElement('details');root.className='constitution-world-diff';root.dataset.testid='constitution-world-diff';
 root.innerHTML='<summary>⭐ Constitution → World Diff</summary><p data-cc-world-status role="status">Open to load the Dear Congress plan.</p><div data-cc-world-content hidden><label>Plan clause<select data-cc-world-clause aria-label="Plan clause"></select></label><h2 data-cc-world-title></h2><p data-cc-world-text></p><p data-cc-world-mapping class="cc-world-note"></p><p data-cc-world-scope class="cc-world-note"></p><p data-cc-world-source class="cc-world-note"></p><a data-cc-world-lab class="cc-world-open">Before / after · policy time machine →</a><p class="cc-world-note">Highlights show modeled or potential scope, not proof of effects on real buildings or residents. The paired lab shows recorded model changes.</p></div>';
 const css=doc.createElement('link');css.rel='stylesheet';css.href=new URL('./host.css',import.meta.url).href;root.append(css);container.append(root);
 const $=selector=>root.querySelector(selector),controller=new AbortController();let destroyed=false,loading=false,plan=null,layer=null,selected=null;
 $('[data-cc-world-lab]').href='/world/constitution-city.html'+(constitutionLocationQuery().size?'?'+constitutionLocationQuery():'');
 function paint(){
  if(!plan||!layer)return;selected=plan.clauses.find(row=>row.id===$('[data-cc-world-clause]').value)||null;
  $('[data-cc-world-title]').textContent=selected?.title||'';$('[data-cc-world-text]').textContent=selected?.text||'';
  $('[data-cc-world-mapping]').textContent=selected?(selected.supported?`${selected.mapping?.label||'Mapped mechanism'}. ${selected.mapping?.assumption||''}`:`Forecast unavailable: ${selected.limitations?.[0]||'No mapped model mechanism.'}`):'';
  const report=layer.update({clause:root.open?selected:null,mode:'scope',month:0});
  $('[data-cc-world-scope]').textContent=report?.summary||'The city overlay marks available clause scope. Run paired futures to inspect actual recorded differences.';
 }
 async function load(){
  if(loading||plan||destroyed)return;loading=true;$('[data-cc-world-status]').textContent='Loading the public policy package…';
  try{
   const [{plan:next},{mountConstitutionWorldLayer}]=await Promise.all([loadConstitutionSource({signal:controller.signal}),import('./world-layer.js')]);if(destroyed)return;
   plan=next;layer=mountConstitutionWorldLayer({THREE,scene,town,camera,controls});const select=$('[data-cc-world-clause]');
   for(const clause of plan.clauses){const option=doc.createElement('option');option.value=clause.id;option.textContent=`${clause.supported?'●':'○'} ${clause.title}`;select.append(option);}
   select.value=plan.clauses.find(c=>c.supported)?.id||plan.clauses[0]?.id||'';$('[data-cc-world-content]').hidden=false;
   $('[data-cc-world-status]').textContent=`${plan.label} · ${plan.clauses.length} public policy clauses`;
   $('[data-cc-world-source]').textContent=`Source: ${plan.provenance.sourceUrl} · retrieved ${plan.provenance.retrievedAt||'time unavailable'}. Policy proposal text.`;paint();
  }catch(error){if(!destroyed)$('[data-cc-world-status]').textContent=`Plan unavailable: ${error.message}. Close and reopen to retry.`;}
  finally{loading=false;}
 }
 const toggle=()=>{if(root.open)plan?paint():load();else layer?.update({clause:null,mode:'scope'});};root.addEventListener('toggle',toggle);$('[data-cc-world-clause]').addEventListener('change',paint);
 return{get selection(){return selected},get plan(){return plan},destroy(){destroyed=true;controller.abort();root.removeEventListener('toggle',toggle);$('[data-cc-world-clause]').removeEventListener('change',paint);layer?.destroy();root.remove();}};
}
