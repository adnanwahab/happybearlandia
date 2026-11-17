import {replayJury, scoreJury, freeze} from './model.js';

export function mountJury(root, {load=async()=>{
  const response=await fetch('/world/city/jury/demo.json');
  if(!response.ok)throw Error('No source data; pinned demo could not be loaded.');
  return response.json();
}, replay=replayJury}={}) {
  const doc=root.ownerDocument;
  const el=(tag,text)=>{const node=doc.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
  const select=el('select');select.setAttribute('aria-label','Jury proposal');
  for(const [value,label] of [['housing','Six public homes · $840,000'],['zoning','Six units of zoning capacity · $20,000']]) {
    const option=el('option',label);option.value=value;select.append(option);
  }
  const run=el('button','Run pinned jury demo'),cancel=el('button','Cancel jury'),clear=el('button','Clear jury evidence');
  for(const button of [run,cancel,clear])button.type='button';
  cancel.disabled=true;
  const status=el('p','No source data; load the pinned authored demo.');status.setAttribute('role','status');
  const result=el('div');
  root.replaceChildren(el('h2','Zoning Jury'),el('p','Convince all three perspectives. Synthetic toy model and authored preferences, not citizen testimony, a poll, or a forecast. No AI testimony is used. No measured observations are included.'),
    el('p','Fixed City seed 42, 120 households, 36 months. Compare each proposal with doing nothing from the same initial state. This demo is independent of the custom experiment form and saved runs.'),select,run,cancel,clear,status,result);
  let generation=0, controller;
  function reset(message){generation++;controller?.abort();controller=null;result.replaceChildren();status.textContent=message;run.disabled=false;cancel.disabled=true;}
  cancel.onclick=()=>reset('Cancelled; no vote recorded.');
  clear.onclick=()=>reset('No source data; load the pinned authored demo.');
  select.onchange=()=>reset('Proposal changed; rerun before viewing a vote.');
  run.onclick=async()=>{
    reset('Recomputing matched checkpoints…');const own=generation,option=select.value;
    controller=new AbortController();const signal=controller.signal;run.disabled=true;cancel.disabled=false;
    try {
      const expected=freeze(await load());if(own!==generation)return;
      const record=await replay(option,{signal,yieldStep:()=>new Promise(resolve=>setTimeout(resolve,0))});
      if(own!==generation)return;
      const score=scoreJury(record,expected[option]);
      if(score.status!=='verified'){status.textContent=score.reason;return;}
      status.textContent=`${score.support} / 3 support · ${score.success?'Challenge met':'Challenge not met'}. Unchanged outcomes hold; all three must support.`;
      result.append(el('p',`Homes: ${score.housing.baseline} → ${score.housing.plan}. Unhoused households: ${score.housing.unhousedBefore} → ${score.housing.unhousedAfter}. Modeled City inventory, not observed delivery.`));
      for(const position of score.positions){
        const card=el('article');card.append(el('h3',position.name),el('p',position.goal),el('p',`${position.label}: ${position.baseline} → ${position.outcome} ${position.unit}`),el('p',`${position.current.vote}: ${position.current.reason}`),
          el('p',position.id==='renters'?'Limitation: average unit rent does not measure each household’s affordability or displacement.':position.id==='services'?'Limitation: counts overloaded facilities; service quality and unequal access are omitted.':'Limitation: cash and proposed cost omit broader welfare and long-term fiscal risk.'));
        result.append(card);
      }
      result.append(el('p','Final rule: count support classifications from these three authored perspectives; success requires 3 of 3. These preferences have no public mandate. No model state or saved vote is changed.'),el('p','Source: createCity → monthly City engine → cityMetrics; preferences: evaluateLivingCouncil. Coefficients and budgets are uncalibrated synthetic assumptions. One matched seed gives no probability or uncertainty interval.'));
      const evidence=el('details');evidence.append(el('summary','Inspect immutable checkpoint inputs and replay evidence'),el('pre',JSON.stringify(record,null,2)));result.append(evidence);
    } catch(error){if(own===generation)status.textContent=error.message;}
    finally{if(own===generation){run.disabled=false;cancel.disabled=true;}}
  };
  return {destroy(){reset('Jury closed; no vote recorded.');run.onclick=cancel.onclick=clear.onclick=select.onchange=null;}};
}
