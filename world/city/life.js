// Endpoint fan: a balanced two-arm descriptive variance decomposition.
export function summarizeLife(rows, arms) {
  const result={};
  for(const metric of ['savings','burden']) {
    const paired=[];
    for(let i=0;i<30;i++) {
      const pair=arms.map(arm=>rows.find(r=>r.arm===arm&&r.index===i));
      if(pair.every(r=>Number.isFinite(r?.[metric])))paired.push(pair.map(r=>r[metric]));
    }
    const mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
    if(!paired.length){result[metric]={n:0};continue;}
    const values=arms.map((_,a)=>paired.map(p=>p[a])),means=values.map(mean),grand=mean(means);
    result[metric]={n:paired.length,means,policyVariance:mean(means.map(v=>(v-grand)**2)),luckVariance:mean(values.map((xs,a)=>mean(xs.map(v=>(v-means[a])**2)))),pairedDifference:mean(paired.map(p=>p[1]-p[0]))};
  }
  return result;
}
export async function collectLife(manifest, householdId, replay, progress=()=>{}) {
  if(manifest.runs<30||manifest.months!==120||manifest.scenarios.length!==2||manifest.initial.month!==0)throw new Error('Requires two arms, at least 30 runs, and Month 0 → 120. Create a 30-run, 120-month experiment.');
  if(manifest.initial.households.filter(h=>h.id===householdId).length!==1)throw new Error('Household identity is absent or ambiguous in the shared initial state');
  const rows=[];
  for(let index=0;index<30;index++)for(const {id:arm} of manifest.scenarios) {
    const result=await replay(arm,index),state=result.state,seed=(manifest.initial.seed+index)>>>0;
    if(state.seed!==seed||state.month!==120)throw new Error('Replay seed or time mismatch');
    const matches=state.households.filter(h=>h.id===householdId);
    if(matches.length>1)throw new Error('Ambiguous replay household identity');
    const h=matches[0],unit=h?.unitId?state.units.find(u=>u.id===h.unitId):null;
    if(h?.unitId&&(!unit||unit.householdId!==householdId))throw new Error('Replay home identity mismatch');
    rows.push({arm,index,seed,householdId,status:h?(unit?'housed':'unhoused'):'departed / unavailable',home:unit?.id??null,savings:h?.savings??null,burden:h&&unit&&h.income>0?unit.rent/h.income:null});
    progress(rows.length);
  }
  return rows;
}
export function mountLife(root) {
  let generation=0,controller=null;
  return {update(record,id){
    generation++;controller?.abort();root.replaceChildren();if(!record)return;
    const title=document.createElement('h2');title.textContent='One Life, Many Worlds';root.append(title);
    const note=document.createElement('p');note.textContent='Synthetic City households only. Month 120 endpoints across 30 matched seeds; replays are recomputations under the saved model. No person or cross-city identity mapping.';root.append(note);
    const select=document.createElement('select');select.setAttribute('aria-label','Household across worlds');
    for(const h of record.manifest.initial.households){const o=document.createElement('option');o.value=h.id;o.textContent=h.id;select.append(o);}root.append(select);
    const button=document.createElement('button');button.textContent='Follow 30 seeds × 2 futures';root.append(button);
    const cancel=document.createElement('button');cancel.textContent='Cancel';cancel.disabled=true;root.append(cancel);
    const output=document.createElement('div');output.setAttribute('aria-live','polite');root.append(output);
    cancel.onclick=()=>controller?.abort();
    button.onclick=async()=>{
      const current=generation;controller=new AbortController();const signal=controller.signal;button.disabled=true;cancel.disabled=false;select.disabled=true;
      try {
        const rows=await collectLife(record.manifest,select.value,async(arm,index)=>{
          const response=await fetch(`/api/city-experiments/${id}/replay`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({scenarioId:arm,runIndex:index}),signal});
          const result=await response.json();if(!response.ok)throw new Error(result.error||'Replay failed');return result;
        },n=>{if(current===generation)output.textContent=`Replaying ${n}/60…`;});
        if(current!==generation)return;
        output.replaceChildren();
        const summary=document.createElement('p'),stats=summarizeLife(rows,record.manifest.scenarios.map(s=>s.id));
        summary.textContent=`N = 30 seeds per arm; household ${select.value}; model ${record.manifest.version}. `+Object.entries(stats).map(([metric,s])=>s.n?`${metric}: ${s.n} complete pairs; between-arm (policy) variance ${s.policyVariance.toFixed(4)}, within-arm (luck) variance ${s.luckVariance.toFixed(4)}; mean paired change ${s.pairedDifference.toFixed(4)}. ${s.policyVariance>s.luckVariance?'Policy':'Luck'} variance is larger.`:`${metric}: no complete pairs.`).join(' ')+ ' Variances use population denominators and squared units (USD² / rent-income ratio²). Balanced complete pairs only; missing, departed and unhoused burden outcomes are excluded. These are descriptive modeled results, not calibrated causal estimates or confidence intervals.';output.append(summary);
        for(const metric of ['savings','burden']) {
          const canvas=document.createElement('canvas');canvas.width=700;canvas.height=200;canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`${metric} endpoint fan; exact values in table below`);output.append(canvas);
          const ctx=canvas.getContext('2d'),values=rows.map(r=>r[metric]).filter(Number.isFinite),min=Math.min(...values),max=Math.max(...values);
          ctx.fillText(`${metric} at Month 120 · ${min.toFixed(2)} to ${max.toFixed(2)}`,10,15);
          record.manifest.scenarios.forEach((s,a)=>{ctx.fillStyle=a?'#b45309':'#2563eb';ctx.fillText(s.id,10,65+a*90);for(const r of rows.filter(r=>r.arm===s.id&&Number.isFinite(r[metric]))){ctx.beginPath();ctx.arc(160+500*(r[metric]-min)/(max-min||1),50+a*90+(r.index%5)*5,3,0,Math.PI*2);ctx.fill();}});
        }
        const table=document.createElement('table'),head=table.createTHead().insertRow(),keys=Object.keys(rows[0]);for(const key of keys){const th=document.createElement('th');th.textContent=key;head.append(th);}for(const row of rows){const tr=table.insertRow();for(const key of keys)tr.insertCell().textContent=row[key]??'unavailable';}output.append(table);
      }catch(error){if(current===generation)output.textContent=signal.aborted?'Replay cancelled.':error.message;}finally{if(current===generation){button.disabled=false;cancel.disabled=true;select.disabled=false;}}
    };
  }};
}
