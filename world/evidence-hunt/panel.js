import {CLUES, readArchive, createHunt} from './core.js';
export function mountEvidenceHunt({container, fetcher=fetch, storage}={}) {
  const doc=container.ownerDocument, root=doc.createElement('details');
  root.className='neighborhood-hunt';root.dataset.testid='neighborhood-hunt';
  root.innerHTML=`<summary>Neighborhood Evidence Hunt</summary>
    <p>Five hidden mechanisms · authored archive route. Explore housing → transit → flood → business → households.</p>
    <p>Synthetic Monthly City toy model, seed 714, integer months 1–3. No measured observations. Clue text is scripted flavor; inspector JSON is recorded model output. This archive has no verified mapping to the visible streets.</p>
    <button type="button" data-start>Open pinned demo</button>
    <button type="button" data-cancel>Cancel hunt</button>
    <button type="button" data-reset>Reset local progress</button>
    <p role="status" aria-live="polite">Open the pinned archive to begin or resume.</p>
    <ol aria-label="Evidence hunt route"></ol>
    <section aria-label="Mechanism inspector" hidden tabindex="-1"><h3>Recorded mechanism</h3><p data-context></p><pre></pre></section>`;
  const style=doc.createElement('style');style.textContent=`.neighborhood-hunt{position:fixed;bottom:12px;left:12px;z-index:97;box-sizing:border-box;width:min(360px,calc(100vw - 24px));max-height:75vh;overflow:auto;background:#142a2bf5;color:#fff3cf;border:1px solid #b9a163;border-radius:10px;padding:10px;font:13px/1.5 system-ui}.neighborhood-hunt summary{cursor:pointer;font-weight:700}.neighborhood-hunt button{font:inherit;min-height:44px;margin:4px;padding:6px;cursor:pointer}.neighborhood-hunt pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px}.neighborhood-hunt :focus-visible{outline:3px solid #ffc96b;outline-offset:2px}`;
  root.append(style);container.append(root);
  const $=selector=>root.querySelector(selector), status=$('[role=status]'), inspector=$('section');
  let controller=null, generation=0, hunt=null, archive=null, destroyed=false;
  let local=storage;
  if(local===undefined)try{local=doc.defaultView.localStorage;}catch{local={getItem(){throw Error();},setItem(){throw Error();}};}
  function clearInspector(){inspector.hidden=true;$('pre').textContent='';$('[data-context]').textContent='';}
  function cancel(){generation++;controller?.abort();controller=null;clearInspector();}
  function render(){
    $('ol').replaceChildren();
    if(!hunt)return;
    const count=hunt.visited.length;
    status.textContent=`${count}/5 mechanisms inspected. ${count===5?'Hunt complete.':''} ${hunt.notice}`;
    CLUES.forEach(([id,clue],index)=>{
      const li=doc.createElement('li'),button=doc.createElement('button');
      li.append(doc.createTextNode(clue+' '));button.type='button';button.textContent=`Inspect ${id}${index<count?' · found':''}`;button.disabled=index>count;
      button.onclick=()=>{
        try{
          const displayed=hunt.open(index);
          $('[data-context]').textContent=`${archive.runId} · ${archive.modelVersion} · seed ${archive.seed} · month ${displayed.stop.month} · source pointer ${displayed.stop.pointer}. Recorded model mechanism, not empirical causal proof.`;
          $('pre').textContent=JSON.stringify(displayed.record,null,2);inspector.hidden=false;
          hunt.inspected(index,displayed);render();inspector.focus();
        }catch(error){clearInspector();status.textContent=error.message;}
      };
      li.append(button);$('ol').append(li);
    });
  }
  async function start(){
    cancel();hunt=null;archive=null;$('ol').replaceChildren();const token=generation;
    const request=new AbortController();controller=request;
    const timer=setTimeout(()=>request.abort(),8000);status.textContent='Loading pinned source records…';
    try{
      const response=await fetcher('/world/evidence-hunt/demo.json',{signal:request.signal,cache:'no-store'});
      if(!response.ok)throw Error('No source data: pinned demo unavailable. Retry opening the demo.');
      const data=await readArchive(await response.text());
      if(destroyed||token!==generation)return;
      archive=data;hunt=createHunt(archive,local);render();
    }catch(error){if(!destroyed&&token===generation)status.textContent=request.signal.aborted?'Source loading timed out. Retry opening the demo.':error.message;}
    finally{clearTimeout(timer);if(controller===request)controller=null;}
  }
  $('[data-start]').onclick=start;
  $('[data-cancel]').onclick=()=>{cancel();hunt=null;archive=null;$('ol').replaceChildren();status.textContent='Hunt cancelled. Inspected progress remains local; no new clues credited.';root.open=false;$('summary').focus();};
  $('[data-reset]').onclick=()=>{
    cancel();
    if(hunt){hunt.reset();render();}
    else try{local?.removeItem('hbl.neighborhood-hunt.v1');status.textContent='Local progress reset.';}catch{status.textContent='Local storage unavailable; reset could not be saved.';}
  };
  return {destroy(){destroyed=true;cancel();root.remove();}};
}
