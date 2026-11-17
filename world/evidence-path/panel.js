import {projectEvidencePath} from './project.js';
import {evidencePathFixture} from './fixture.js';
import {createEvidencePathLayer} from './layer.js';

export function mountEvidencePath({container, THREE, scene, camera, controls, frameId = null, mapping = null, fetcher = fetch}) {
  const doc=container.ownerDocument, root=doc.createElement('details');
  root.className='world-evidence-path';root.dataset.testid='evidence-path';
  root.innerHTML=`<summary>Evidence paths</summary>
    <p>Follow recorded event connections. Ground markers are decorative straight connectors, not streets or proof of real-world causation.</p>
    <form><label>Run ID <input name="run" required maxlength="512"></label><label>Target event ID <input name="target" required maxlength="512"></label><button>Load recorded chain</button></form>
    <button type="button" data-fixture>Try synthetic path</button> <button type="button" data-skip>Skip path</button>
    <p role="status" aria-live="polite" data-status>No chain selected. Stored events require explicit scene locations; missing locations remain jumps.</p>
    <ol aria-label="Evidence path itinerary" data-itinerary></ol>
    <details><summary>Attached evidence inspector</summary><div data-records></div></details>`;
  const style=doc.createElement('style');style.textContent=`.world-evidence-path{position:fixed;left:12px;bottom:64px;z-index:96;box-sizing:border-box;width:min(360px,calc(100vw - 24px));max-height:62vh;overflow:auto;padding:12px;border:1px solid #b9a163;border-radius:10px;background:#142a2bf5;color:#fff3cf;font:13px/1.5 system-ui}.world-evidence-path summary{cursor:pointer;font-weight:700}.world-evidence-path input{box-sizing:border-box;width:100%;font:inherit}.world-evidence-path label{display:block}.world-evidence-path button{font:inherit;margin:5px 2px;padding:7px;cursor:pointer}.world-evidence-path p,.world-evidence-path li{overflow-wrap:anywhere}.world-evidence-path pre{white-space:pre-wrap;overflow-wrap:anywhere;font:11px/1.5 monospace}.world-evidence-path ol{padding-left:22px}`;
  root.append(style);container.append(root);
  const $=selector=>root.querySelector(selector),layer=createEvidencePathLayer({THREE,scene});
  let controller=null,version=0,destroyed=false,report=null;
  function cancel(){version++;controller?.abort();controller=null;}
  function reset(){layer.clear();$('[data-itinerary]').replaceChildren();$('[data-records]').replaceChildren();report=null;}
  function text(tag,value){const node=doc.createElement(tag);node.textContent=value;return node;}
  function show(data, locations=mapping, frame=frameId, fixture=false){
    if(destroyed)return;
    report=projectEvidencePath(data,locations,frame);layer.show(report);
    const context=report.records[0]?.context;
    $('[data-status]').textContent=(fixture?'Synthetic fixture v1 · authored assumptions only; no observed sources or computed model effects. Positions are an illustrative stage laid over the scene, unrelated to its buildings. ':'Stored model evidence · ') +
      (context?`Run ${context.runId} · model ${context.modelVersion} · seed ${context.seed}. `:'')+report.notices.join(' ') + ' ' + report.segments.filter(s=>s.kind==='jump').length+' labeled jumps.';
    const list=$('[data-itinerary]');list.replaceChildren();
    for(const segment of report.segments){
      const li=text('li',`${segment.from.label??segment.from.type} → ${segment.to.label??segment.to.type} · ${segment.relation} · ticks ${segment.from.context.tick}–${segment.to.context.tick}. ${segment.reason??'Mapped ground segment.'}`);
      for(const [label,point] of [['From',segment.start],['To',segment.end]]) if(point) li.append(text('p',`${label} location · ${point.provenance.kind} · ${point.provenance.source}`));
      li.dataset.edgeId=segment.id;li.dataset.fromEvent=segment.eventIds[0];li.dataset.toEvent=segment.eventIds[1];
      li.append(text('p',`${segment.id} · ${segment.eventIds.join(' → ')} · citations: ${segment.evidenceIds.join(', ')}`));
      if(segment.kind==='segment'){
        const button=text('button','View ground segment');button.type='button';
        button.onclick=()=>{const p=segment.start;controls.target.set(p.x,0,p.z);camera.position.set(p.x+25,45,p.z+45);controls.update();};li.append(button);
      }
      list.append(li);
    }
    const records=$('[data-records]');records.replaceChildren();
    for(const record of report.records){
      const detail=doc.createElement('details');detail.append(text('summary',`${record.label??record.type??record.id} · ${record.provenance?.kind??'provenance unavailable'}`),text('pre',JSON.stringify(record,null,2)));records.append(detail);
    }
  }
  async function load(event){
    event.preventDefault();cancel();reset();const token=version;
    const run=root.querySelector('[name=run]').value.trim(),target=root.querySelector('[name=target]').value.trim();
    controller=new AbortController();const request=controller,signal=request.signal,timer=setTimeout(()=>request.abort(),8000);
    $('[data-status]').textContent='Loading recorded evidence…';
    try{
      const response=await fetcher('/api/causality/explain?'+new URLSearchParams({runId:run,targetId:target,maxNodes:'100',maxEdges:'200'}),{signal});
      if(!response.ok)throw Error(response.status===404?'Run or event unavailable. Check the recorded IDs.':'Evidence request failed. Retry loading.');
      const data=await response.json();if(!destroyed&&version===token)show(data);
    }catch(error){if(!destroyed&&version===token)$('[data-status]').textContent=signal.aborted?'Evidence request timed out. Retry loading.':error.message;}
    finally{clearTimeout(timer);if(version===token)controller=null;}
  }
  const fixtureClick=()=>{cancel();reset();const fixture=evidencePathFixture();show(fixture.data,fixture.mapping,fixture.mapping.frameId,true);};
  const skip=()=>{cancel();reset();$('[data-status]').textContent='Path skipped. No ground markers remain.';root.open=false;root.querySelector('summary').focus();};
  const toggle=()=>{if(!root.open){cancel();reset();$('[data-status]').textContent='No chain selected. Load recorded IDs or try the synthetic fixture.';}};
  root.querySelector('form').addEventListener('submit',load);$('[data-fixture]').addEventListener('click',fixtureClick);$('[data-skip]').addEventListener('click',skip);root.addEventListener('toggle',toggle);
  return {getReport:()=>report?structuredClone(report):null,getStats:layer.stats,destroy(){destroyed=true;cancel();layer.destroy();root.querySelector('form').removeEventListener('submit',load);$('[data-fixture]').removeEventListener('click',fixtureClick);$('[data-skip]').removeEventListener('click',skip);root.removeEventListener('toggle',toggle);root.remove();}};
}
