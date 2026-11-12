import {DEFAULT_RECIPE} from '../contracts.js';
import {calendarLabel, clampMonth, metricPresentation, metricSemantics, householdObservation, householdSummary} from './model.js';

/** Mount a renderer-independent view. Call update with recorded data; see README. */
export function mountFutureMachineUI(root, options = {}) {
  const doc = root.ownerDocument;
  let state = {month:0, ready:false, busy:false, blink:false, cities:[], policies:[], metrics:{}, households:[], ...options.initialState};
  let timer = null, generation = 0, destroyed = false;
  const listeners = [];
  function node(tag, text, className) {
    const element = doc.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  }
  function listen(element, event, callback) { element.addEventListener(event, callback); listeners.push(() => element.removeEventListener(event, callback)); }
  function button(text, callback) { const element = node('button', text); element.type='button'; listen(element,'click',callback); return element; }
  function field(text, input) { const label=node('label',text); label.append(input); return label; }
  const shell=node('section',undefined,'fm-ui'); shell.setAttribute('aria-label','Future Machine controls');
  const header=node('header',undefined,'fm-header');
  const title=node('div'); title.append(node('p','10 YEARS · 2 FUTURES · 1 DECISION','fm-eyebrow'),node('h1','One City, Two Futures'),node('p','One shared beginning. One housing plan. Explore ten modeled years.','fm-subtitle'));
  header.append(title); shell.append(header);
  const form=node('form',undefined,'fm-setup');
  const city=node('select'), policy=node('select');
  const policyNote=node('p',undefined,'fm-policy-note');
  const fork=node('button','Fork City','fm-primary'); fork.type='submit';
  const cancel=button('Cancel run',()=>{ generation++; options.onCancel?.(); update({busy:false,status:'Run cancelled. Existing comparison preserved.'}); });
  form.append(field('City',city),field('Plan',policy),fork,cancel,policyNote); shell.append(form);
  const status=node('p','Choose a city and policy to begin.','fm-status'); status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
  const error=node('p',undefined,'fm-error'); error.setAttribute('role','alert'); error.hidden=true;
  const progress=node('progress'); progress.max=1; progress.setAttribute('aria-label','Simulation progress'); progress.hidden=true;
  shell.append(status,error,progress);
  const comparison=node('section',undefined,'fm-comparison'); comparison.setAttribute('aria-label','Matched city futures');
  const stage=node('div',undefined,'fm-stage'); stage.setAttribute('aria-label','Synchronized city visualization');stage.dataset.testid='future-machine-stage';
  const legends=node('div',undefined,'fm-legends'); legends.append(node('span','WITHOUT PLAN'),node('span','WITH PLAN'));
  const provenance=node('p','No spatial data loaded.','fm-provenance'); comparison.append(legends,stage,provenance); shell.append(comparison);
  const timeline=node('section',undefined,'fm-timeline'); timeline.setAttribute('aria-label','Shared timeline');
  const date=node('output'); const slider=node('input'); slider.type='range';slider.dataset.testid='future-machine-timeline'; slider.min=0; slider.max=120; slider.step=1; slider.setAttribute('aria-label','Shared month for Future A and Future B');
  const play=button('Play timelapse',()=>options.externalPlayback ? options.onPlay?.(!state.playing) : timer ? pause() : start());
  const blink=button('Blink A/B',()=>{update({blink:!state.blink}); options.onBlink?.(state.blink);});
  const changed=button('Show Me What Changed',()=>action(options.onShowChanges)); changed.className='fm-primary';
  const ticks=node('div',undefined,'fm-ticks'); for(const year of ['2026','2031','2036'])ticks.append(node('span',year));
  const transport=node('div',undefined,'fm-actions'); transport.append(play,blink,changed);
  timeline.append(date,slider,ticks,transport); shell.append(timeline);
  const cards=node('section',undefined,'fm-metrics'); cards.setAttribute('aria-label','Measured outcomes');cards.dataset.testid='future-machine-metrics';
  const metricNodes={};
  for(const [key,label] of [['homes','Homes'],['rent','Mean unit rent'],['spending','City spending']]) {
    const card=node('article',undefined,'fm-card'), delta=node('strong'), values=node('p'), detail=node('p',undefined,'fm-detail');
    const why=button(`WHY · ${label}`,()=>action(options.onMetric,key)); why.className='fm-metric-why'; why.disabled=true;
    card.append(node('h2',label),delta,values,detail,why); cards.append(card); metricNodes[key]={card,delta,values,detail,why};
  }
  shell.append(cards);
  const inspectors=node('section',undefined,'fm-inspectors');
  const householdPanel=node('section'), household=node('select'), householdBody=node('pre');
  const householdSummaryNode=node('p',undefined,'fm-household-summary'),householdRaw=node('details');householdRaw.append(node('summary','Inspect exact household records'),householdBody); household.setAttribute('aria-label','Monthly City household');
  householdPanel.append(node('h2','Household outcomes'),household,householdSummaryNode,householdRaw);
  const evidencePanel=node('section'), evidence=node('pre'); const evidenceRaw=node('details');evidenceRaw.append(node('summary','Inspect run and comparison record'),evidence);evidencePanel.append(node('h2','Evidence inspector'),node('p','Click a changed building or WHY on a measured outcome to inspect its recorded event, policy and model rule.'),evidenceRaw);
  inspectors.append(householdPanel,evidencePanel); shell.append(inspectors);
  const footer=node('footer',undefined,'fm-actions');
  const share=button('Share comparison',()=>action(options.onShare)); const exportButton=button('Export evidence',()=>action(options.onExport));
  footer.append(share,exportButton); shell.append(footer); root.append(shell);
  async function action(callback, ...args) {
    if (!callback) return;
    try { await callback(...args); } catch (failure) { if(!destroyed) update({error:failure?.message || String(failure)}); }
  }
  function pause() { clearInterval(timer); timer=null; play.textContent='Play timelapse'; play.setAttribute('aria-pressed','false'); }
  function seek(month) { update({month:clampMonth(month)}); options.onMonthChange?.(state.month); }
  function start() { if(!state.ready || state.busy)return; if(state.month===120)seek(0); play.textContent='Pause timelapse'; play.setAttribute('aria-pressed','true'); timer=setInterval(()=>{seek(state.month+1);if(state.month===120)pause();}, options.playInterval ?? 400); }
  listen(slider,'input',()=>{pause();seek(slider.value);});
  listen(city,'change',()=>{state.cityId=city.value;options.onCityChange?.(city.value);});
  listen(policy,'change',()=>{state.policyId=policy.value;renderPolicy();options.onPolicyChange?.(policy.value);});
  listen(household,'change',()=>{state.householdId=household.value;renderHousehold();options.onHouseholdChange?.(household.value);});
  listen(form,'submit',async event=>{
    event.preventDefault(); if(state.busy || !options.onFork)return;
    pause();const current=++generation;update({busy:true,error:null,status:'Running matched 120-month futures…',progress:null});
    try {await options.onFork({cityId:city.value,policyId:policy.value});if(current===generation&&!destroyed)update({busy:false});}
    catch(failure){if(current===generation&&!destroyed)update({busy:false,error:failure?.message || String(failure),status:'Run failed. Try again.'});}
  });
  function fill(select, rows, selected) { select.replaceChildren(...rows.map(row=>{const item=node('option',row.label || row.name || row.id);item.value=row.id;return item;})); if(rows.some(row=>row.id===selected))select.value=selected; }
  function renderPolicy(){ const item=state.policies.find(row=>row.id===policy.value); policyNote.textContent=item?.description || 'Only model-supported interventions are available.'; }
  function renderHousehold(){ const row=state.households.find(item=>item.id===household.value); householdSummaryNode.textContent=householdSummary(row);householdBody.textContent=row ? JSON.stringify(row,null,2) : 'No supported household observations for this month.'; }
  function update(patch={}) {
    if(destroyed)return;
    const old=state;state={...state,...patch,month:clampMonth(patch.month ?? state.month)};
    if(patch.cities && (!city.options.length || JSON.stringify(patch.cities)!==JSON.stringify(old.cities)))fill(city,state.cities,state.cityId ?? city.value);
    if(patch.policies && (!policy.options.length || JSON.stringify(patch.policies)!==JSON.stringify(old.policies)))fill(policy,state.policies,state.policyId ?? policy.value);
    if('cityId' in patch)city.value=state.cityId;
    if('policyId' in patch)policy.value=state.policyId;
    renderPolicy();
    city.disabled=policy.disabled=state.busy;
    fork.disabled=state.busy || !state.cities.length || !state.policies.length || !options.onFork;
    cancel.hidden=!state.busy || !options.onCancel;progress.hidden=!state.busy;
    if(typeof state.progress==='number'&&Number.isFinite(state.progress))progress.value=Math.min(1,Math.max(0,state.progress));else progress.removeAttribute('value');
    if(state.status)status.textContent=state.status;
    error.hidden=!state.error;error.textContent=state.error || '';
    shell.setAttribute('aria-busy',String(state.busy));
    date.textContent=`${calendarLabel(state.month)} · Month ${state.month} / 120`;slider.value=state.month;slider.setAttribute('aria-valuetext',date.textContent);
    for(const element of [slider,play,blink])element.disabled=!state.ready || state.busy;
    changed.disabled=!state.ready || state.busy || !options.onShowChanges;
    blink.setAttribute('aria-pressed',String(state.blink)); blink.textContent=state.blink?'Blink: Future B':'Blink: Future A';
    if(!state.ready || state.busy)pause();
    else if(options.externalPlayback){play.textContent=state.playing?'Pause timelapse':'Play timelapse';play.setAttribute('aria-pressed',String(!!state.playing));}
    provenance.textContent=state.spatialLabel || 'No spatial data loaded. Unlocated changes remain in the inspector.';
    for(const key of Object.keys(metricNodes)){const item=metricPresentation(state.metrics?.[key]); const elements=metricNodes[key];elements.delta.textContent=item.delta;elements.values.replaceChildren(node('span',`WITHOUT PLAN  ${item.baseline}`,'fm-value-baseline'),node('span',`WITH PLAN  ${item.intervention}`,'fm-value-plan'));const semantics=metricSemantics(key,state.metrics?.[key]);elements.card.dataset.tone=semantics.tone;elements.detail.textContent=key==='rent' && semantics.tone==='neutral' && item.delta!=='Unavailable' ? `${semantics.label}.` : `${semantics.label}. ${item.detail}`;elements.why.disabled=!state.ready || state.busy || !options.onMetric || item.delta==='Unavailable';}
    if(patch.households){fill(household,state.households,state.householdId ?? household.value);renderHousehold();}
    household.disabled=!state.households.length;
    if('householdId' in patch){household.value=state.householdId;renderHousehold();}
    if('evidence' in patch)evidence.textContent=state.evidence ? JSON.stringify(state.evidence,null,2) : 'No recorded evidence selected.';
    if(!evidence.textContent)evidence.textContent='No recorded evidence selected.';
    if(!householdBody.textContent)renderHousehold();
    share.disabled=!state.ready || state.busy || !options.onShare;exportButton.disabled=!state.ready || state.busy || !options.onExport;
    if(old.month!==state.month)options.onRenderMonth?.(state.month);
  }
  update(state);
  return {stage,update,getState:()=>({...state}),pause,destroy(){destroyed=true;generation++;pause();listeners.forEach(remove=>remove());shell.remove();}};
}

/** Frozen interface v1 adapter. The coordinator owns simulation, playback, and scene rendering. */
export function createUI(container, callbacks = {}) {
  let current={status:'idle',month:0,playing:false,mode:'split',ghosts:true};
  let recipe=structuredClone(DEFAULT_RECIPE), configurationDirty=false;
  const view=mountFutureMachineUI(container,{
    externalPlayback:true,
    onFork:()=>{if(!configureSeed())throw new Error(seedError.textContent);return callbacks.onRun?.(structuredClone(recipe));},
    onMonthChange:month=>callbacks.onMonth?.(month),
    onPlay:value=>callbacks.onPlay?.(value),
    onBlink:value=>callbacks.onMode?.(value?'plan':'baseline'),
    onShowChanges:callbacks.onDirector,
    onShare:callbacks.onShare,
    onExport:callbacks.onExport,
    onCancel:callbacks.onCancel,
    onMetric:callbacks.onMetric ? key=>callbacks.onMetric({homes:'housingUnits',commute:'meanTravelMinutes',rent:'meanRent',spending:'capitalSpending'}[key]) : undefined,
    onPolicyChange:id=>{recipe={...recipe,intervention:id==='baseline'?null:structuredClone(defaultIntervention)};configurationDirty=true;callbacks.onConfigure?.(structuredClone(recipe));},
  });
  let defaultIntervention=structuredClone(DEFAULT_RECIPE.intervention);
  const doc=container.ownerDocument;
  const shell=view.stage.closest('.fm-ui');
  const seedLabel=doc.createElement('label');seedLabel.textContent='Seed for next run';seedLabel.className='fm-seed-label';
  const seedInput=doc.createElement('input');seedInput.type='text';seedInput.setAttribute('aria-label','Seed for next run');seedInput.inputMode='numeric';seedInput.pattern='[0-9]+';seedInput.required=true;seedInput.value=String(recipe.seed);seedInput.dataset.testid='future-machine-seed';
  const seedError=doc.createElement('p');seedError.className='fm-error fm-seed-error';seedError.setAttribute('role','alert');seedError.hidden=true;
  const seedHelp=doc.createElement('small');seedHelp.textContent='Unsigned integer 0–4294967295. Applies when you Fork City; displayed run stays unchanged.';
  seedLabel.append(seedInput,seedHelp);shell.querySelector('.fm-setup').insertBefore(seedLabel,shell.querySelector('.fm-setup button'));shell.querySelector('.fm-setup').append(seedError);
  function configureSeed(){
    const text=seedInput.value;
    const valid=/^[0-9]+$/.test(text) && Number.isSafeInteger(Number(text)) && Number(text)<=4294967295;
    seedError.hidden=valid;seedError.textContent=valid?'':'Seed must be a whole number from 0 through 4294967295.';seedInput.setAttribute('aria-invalid',String(!valid));seedInput.setCustomValidity(valid?'':seedError.textContent);
    if(!valid){configurationDirty=true;return false;}
    const nextSeed=Number(text);
    if(nextSeed!==recipe.seed){recipe={...recipe,seed:nextSeed};configurationDirty=true;callbacks.onConfigure?.(structuredClone(recipe));}
    return true;
  }
  seedInput.oninput=configureSeed;

  const storyElement=doc.createElement('section');storyElement.className='fm-story';storyElement.dataset.testid='future-machine-why';storyElement.setAttribute('aria-label','Recorded change story');shell.querySelector('.fm-inspectors').after(storyElement);
  const actions=shell.querySelector('.fm-timeline .fm-actions');
  const demoPanel=doc.createElement('section');demoPanel.className='fm-demo';demoPanel.setAttribute('aria-label','Guided demo');
  const demo=doc.createElement('button');demo.type='button';demo.className='fm-primary fm-demo-play';demo.textContent='Play Demo';demo.dataset.testid='future-machine-demo';demo.onclick=()=>callbacks.onDemo?.();
  const demoPause=doc.createElement('button');demoPause.type='button';demoPause.textContent='Pause demo';demoPause.onclick=()=>callbacks.onDemoPause?.();demoPause.hidden=true;
  const demoCaption=doc.createElement('p');demoCaption.className='fm-demo-caption';demoCaption.setAttribute('role','status');demoCaption.textContent='A guided 45–60 second comparison. Pause anytime to explore.';
  demoPanel.append(demo,demoPause,demoCaption);shell.querySelector('.fm-header').after(demoPanel);
  const runProvenance=doc.createElement('p');runProvenance.className='fm-run-provenance';runProvenance.setAttribute('aria-label','Simulation provenance');shell.querySelector('.fm-comparison').before(runProvenance);
  const difference=doc.createElement('button');difference.type='button';difference.textContent='Difference-only';difference.onclick=()=>callbacks.onMode?.('difference');actions.append(difference);
  const split=doc.createElement('button');split.type='button';split.textContent='Side by side';split.onclick=()=>callbacks.onMode?.('split');actions.append(split);
  const ghostsLabel=doc.createElement('label');const ghosts=doc.createElement('input');ghosts.type='checkbox';ghosts.checked=true;ghosts.onchange=()=>callbacks.onGhosts?.(ghosts.checked);ghostsLabel.append(ghosts,doc.createTextNode(' Ghost differences'));actions.append(ghostsLabel);
  const shareLink=doc.createElement('a');shareLink.textContent='Open comparison link';shareLink.hidden=true;shareLink.className='fm-share-link';shell.append(shareLink);
  const noPhysical=doc.createElement('p');noPhysical.className='fm-detail';shell.querySelector('.fm-metrics').after(noPhysical);
  function update(patch={}) {
    const previousExperiment=current.experimentId ?? current.provenance?.experimentId;
    current={...current,...patch,...(patch.demo?{demo:{...current.demo,...patch.demo}}:{}),...(patch.provenance?{provenance:{...current.provenance,...patch.provenance}}:{})};
    if(patch.recipe){
      const incomingExperiment=current.experimentId ?? current.provenance?.experimentId;
      const accepted=seedInput.getAttribute('aria-invalid')!=='true' && JSON.stringify(patch.recipe)===JSON.stringify(recipe);
      if(!configurationDirty || accepted || (previousExperiment && incomingExperiment && previousExperiment!==incomingExperiment)){
        recipe=structuredClone(patch.recipe);configurationDirty=false;seedInput.value=String(recipe.seed);seedError.hidden=true;seedInput.setCustomValidity('');seedInput.setAttribute('aria-invalid','false');
        if(recipe.intervention)defaultIntervention=structuredClone(recipe.intervention);
      }
    }
    const busy=['loading','running','queued'].includes(current.status);seedInput.disabled=busy;
    const demoState=current.demo || {};
    const demoActive=['playing','running','paused','preparing','loading'].includes(demoState.status);
    demo.disabled=busy || !callbacks.onDemo;demo.textContent=demoActive?'Restart Demo':'Play Demo';
    demoPause.hidden=!demoActive;demoPause.disabled=busy || !callbacks.onDemoPause;demoPause.textContent=demoState.paused?'Resume demo':'Pause demo';demoPause.setAttribute('aria-pressed',String(!!demoState.paused));
    demoCaption.textContent=demoState.caption || (demoState.status==='complete'?'Demo complete. Scrub the timeline or select a result to explore.':'A guided 45–60 second comparison. Pause anytime to explore.');
    if(Number.isFinite(demoState.elapsedMs))demoCaption.textContent+=` · ${Math.floor(Math.max(0,demoState.elapsedMs)/1000)}s`;
    const provenance=current.provenance || {};
    runProvenance.textContent=`MONTH ${current.month} / 120 · SEED ${provenance.seed ?? current.recipe?.seed ?? 'Unavailable'} · MODEL ${provenance.modelVersion ?? current.recipe?.modelVersion ?? 'Unavailable'} · RUN ${provenance.experimentId ?? current.experimentId ?? 'Not run yet'}`;
    const ready=!!current.frame && !busy;
    const metrics={};
    for(const [key,source] of [['homes','housingUnits'],['rent','meanRent'],['spending','capitalSpending']]){
      const metric=current.diff?.metrics?.[source];
      metrics[key]=metric?{baseline:metric.baseline,intervention:metric.plan,unit:metric.unit,available:metric.status!=='missing',note:key==='rent'?'All recorded units, including new inventory; not incumbent rent savings.':key==='spending'?'Cumulative capital spending in USD; cost is not a welfare gain.':undefined}:null;
    }
    const a=current.frame?.baseline?.state?.households||[],b=current.frame?.plan?.state?.households||[];
    const ids=[...new Set([...a,...b].map(row=>row.id))].sort();
    const households=ids.map(id=>({id,label:`City household ${id}`,baseline:a.find(row=>row.id===id)??null,plan:b.find(row=>row.id===id)??null,baselineHousing:householdObservation(a.find(row=>row.id===id),current.frame?.baseline?.state?.units),planHousing:householdObservation(b.find(row=>row.id===id),current.frame?.plan?.state?.units)}));
    view.update({busy,ready,month:current.month,playing:current.playing,status:current.message,error:current.error,metrics,households,
      cities:[{id:'synthetic',label:'Riverside · Synthetic City'}],
      policies:defaultIntervention?[{id:'housing',label:'Housing intervention',description:`${defaultIntervention.amount} proposed homes · ${defaultIntervention.cost} illustrative USD · district ${defaultIntervention.districtId}. Construction and funding constraints still apply.`},{id:'baseline',label:'No intervention (matched control)',description:'Compare two unchanged futures from the same initial state and seed.'}]:[{id:'baseline',label:'No intervention (matched control)'}],
      policyId:recipe?.intervention?'housing':'baseline',spatialLabel:'Synthetic schematic layout · Monthly City model · January 2026–January 2036 · Uncalibrated assumptions. No real-world geometry inferred. Private parcel capacity 0; utility capacity 200 per district/network; annual growth 0.',
      blink:current.mode==='plan',evidence:current.diff?{month:current.month,experimentId:current.experimentId,changedCount:current.diff.changedCount,physicalCount:current.diff.physicalCount,source:'Monthly City comparison. Select an entity for recorded evidence.'}:null,
    });
    noPhysical.textContent=current.diff ? (current.diff.available===false?'Comparison unavailable for this month.':current.diff.physicalCount===0?'No physical building or link difference recorded at this month.':'Physical changes are recorded; inspect the highlighted entities for evidence.') : '';
    difference.disabled=split.disabled=ghosts.disabled=!ready;difference.setAttribute('aria-pressed',String(current.mode==='difference'));split.setAttribute('aria-pressed',String(current.mode==='split'));ghosts.checked=current.ghosts;
    shareLink.hidden=!current.shareURL;
    if(current.shareURL){try{const url=new URL(current.shareURL,doc.baseURI);if(['http:','https:'].includes(url.protocol))shareLink.href=url.href;else{shareLink.removeAttribute('href');shareLink.hidden=true;}}catch{shareLink.removeAttribute('href');shareLink.hidden=true;}}
  }
  return {stageElement:view.stage,storyElement,update,dispose(){seedInput.oninput=null;demo.onclick=null;demoPause.onclick=null;difference.onclick=null;split.onclick=null;ghosts.onchange=null;view.destroy();}};
}
