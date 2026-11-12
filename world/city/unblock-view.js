import {UNBLOCK_FIXES} from './unblock.js';
export function mountProjectUnblock(container) {
  container.innerHTML=`<h3>What would unblock this?</h3><p class="subtle">Select an unfinished project in this saved month. Compare the same future with one extra resource.</p>
  <label>Project to inspect<select data-project></select></label><button data-inspect>Inspect project</button><p data-status role="status" aria-live="polite">Enter a future to inspect its projects.</p>
  <div data-evidence class="table-wrap"></div><form data-form><div class="pair"><label>Proposed fix<select data-resource></select></label><label>Additional capacity<input data-amount type="number" min="0.01" max="100000" step="any" value="200" required></label></div>
  <div class="pair"><label>Assumed one-time public cost (USD)<input data-cost type="number" min="0" max="1000000000000" value="100000" required></label><label>Comparison horizon (months)<input data-months type="number" min="1" max="60" value="24" required></label></div>
  <p class="subtle">Capacity starts next month; cost is paid from saved city cash. This diagnostic assumes immediate procurement. Both continuations keep the recorded seed and shocks.</p>
  <button data-test type="submit">Test this fix</button> <button data-cancel type="button" disabled>Cancel</button></form><div data-result></div>`;
  const $=key=>container.querySelector(`[data-${key}]`);let state=null,source=null,worker=null,serial=0,currentTimer=null;
  const money=x=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(x);
  const text=(root,tag,value)=>{const node=document.createElement(tag);node.textContent=value;root.append(node);return node;};
  function table(root,rows){if(!rows.length){text(root,'p','No recorded constraints.');return;}const table=document.createElement('table'),head=table.createTHead().insertRow(),keys=Object.keys(rows[0]);for(const key of keys)text(head,'th',key);const body=table.createTBody();for(const row of rows){const tr=body.insertRow();for(const key of keys)text(tr,'td',String(row[key]??''));}root.append(table);}
  for(const [id,spec]of Object.entries(UNBLOCK_FIXES)){const option=document.createElement('option');option.value=id;option.textContent=spec.label;$('resource').append(option);}
  function controls(busy=false){for(const key of ['project','inspect','resource','amount','cost','months','test'])$(key).disabled=!state||!$('project').value||busy;$('cancel').disabled=!busy;}
  function cancel(){clearTimeout(currentTimer);serial++;worker?.terminate();worker=null;controls();}
  function clear(){for(const a of $('result').querySelectorAll('a[href^="blob:"]'))URL.revokeObjectURL(a.href); $('evidence').replaceChildren();$('result').replaceChildren();}
  function request(type) {
    if(!state||!$('project').value)return;
    cancel();const token=serial;controls(true);$('status').textContent=type==='inspect'?'Checking the next simulated month…':'Comparing the original future with your fix…';
    worker=new Worker(new URL('./unblock.worker.js',import.meta.url),{type:'module'});
    const timer=currentTimer=setTimeout(()=>{if(token===serial){cancel();$('status').textContent='Comparison exceeded 30 seconds. Try a shorter horizon.';}},30000);
    worker.onmessage=({data})=>{clearTimeout(timer);if(token!==serial)return;cancel();if(data.error){$('status').textContent=data.error;return;}
      if(type==='inspect') {
        const report=data.result;$('evidence').replaceChildren();text($('evidence'),'p',report.note);
        table($('evidence'),report.constraints);text($('evidence'),'h4','Utility headroom / housing completion demand');table($('evidence'),report.utilities);
        text($('evidence'),'h4','Shared monthly capacities');table($('evidence'),report.capacities);
        $('resource').value=report.suggested;$('amount').value=report.suggested==='permits'?1:200;
        $('status').textContent=`Project ${report.project.id} · ${report.project.stage} · saved month ${report.month}`;
      } else {
        const r=data.result,box=$('result');box.replaceChildren();text(box,'h4','Original future vs proposed fix');
        text(box,'p',`Tested: +${r.fix.amount} ${r.fix.resource} · assumed public outlay ${money(r.fix.cost)} · months ${r.startMonth}–${r.endMonth} · seed ${r.seed}.`);
        const completion=m=>m===null?'Not completed within horizon':`Month ${m}`;
        table(box,[{outcome:'Project completion',original:completion(r.baseline.completionMonth),tested:completion(r.tested.completionMonth)},
          {outcome:'City public spending',original:money(r.baseline.publicCost),tested:money(r.tested.publicCost)},
          {outcome:'City capital spending',original:money(r.baseline.capitalCost),tested:money(r.tested.capitalCost)},
          {outcome:'Ending city cash balance',original:money(r.baseline.balance),tested:money(r.tested.balance)}]);
        text(box,'p',r.monthsEarlier!==null?`${r.monthsEarlier>0?r.monthsEarlier+' months earlier':r.monthsEarlier<0?(-r.monthsEarlier)+' months later':'Same completion month'}. Public spending change: ${money(r.publicCostDelta)}.`:r.tested.completionMonth!==null?`The tested project completes in month ${r.tested.completionMonth}; the original remains unfinished within this horizon. Public spending change: ${money(r.publicCostDelta)}.`:`The tested project remains unfinished within this horizon. Public spending change: ${money(r.publicCostDelta)}.`);
        const reasons=r.tested.events.filter(e=>e.payload.reason).map(e=>({month:e.simulationTime,constraint:e.payload.reason}));text(box,'h4','Remaining recorded constraints');table(box,reasons);
        const a=document.createElement('a');a.textContent='Download comparison evidence (JSON)';const blob=new Blob([JSON.stringify(r,null,2)],{type:'application/json'});a.href=URL.createObjectURL(blob);a.download='project-unblock-comparison.json';box.append(a);
        for(const note of r.assumptions)text(box,'p',note).className='subtle';$('status').textContent='Comparison complete. Original future preserved.';
      }
    };
    worker.onerror=event=>{clearTimeout(timer);if(token!==serial)return;cancel();$('status').textContent=event.message||'Inspector worker failed';};
    worker.postMessage({type,state,projectId:$('project').value,fix:{resource:$('resource').value,amount:Number($('amount').value),cost:Number($('cost').value)},months:Number($('months').value),source});
  }
  $('inspect').onclick=()=>request('inspect');$('project').onchange=()=>{clear();request('inspect');};
  $('resource').onchange=()=>{$('amount').value=$('resource').value==='permits'?1:200;};
  $('form').onsubmit=event=>{event.preventDefault();for(const a of $('result').querySelectorAll('a[href^="blob:"]'))URL.revokeObjectURL(a.href);$('result').replaceChildren();request('compare');};
  $('cancel').onclick=()=>{cancel();$('status').textContent='Cancelled. Original future preserved.';};
  controls();
  return {update(next,metadata=null){cancel();state=next?structuredClone(next):null;source=metadata;clear();const select=$('project');select.replaceChildren();
    for(const p of state?.projects||[]){if(['completion','abandoned'].includes(p.stage))continue;const option=document.createElement('option');option.value=p.id;option.textContent=`${p.id} · ${p.stage}`;select.append(option);}
    controls();$('status').textContent=state?(select.value?`Saved month ${state.month}. Choose a project to inspect.`:'No unfinished projects in this saved month.'):'Enter a future to inspect its projects.';
  }};
}
