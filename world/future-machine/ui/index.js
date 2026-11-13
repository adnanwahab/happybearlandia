import {mountFamilyCard} from './family-card.js';
import {mountControlReadiness} from '../../onboarding/first-run-repairs.js';

import {PLAYABLE_RECIPES} from '../recipes.js';
import {createShareURL} from '../share/index.js';
import {provenancePresentation, MONTHLY_CITY_PROVENANCE} from './provenance.js';
import {DEFAULT_RECIPE} from '../contracts.js';
import {policyChoices, policyId} from './policies.js';
import {calendarLabel, clampMonth, metricPresentation, metricSemantics, householdObservation, householdSummary, comparisonMetric, firstConstructionLabel} from './model.js';

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
  const explanation=node('details',undefined,'fm-explanation');
  explanation.append(node('summary','How this simulation works'));
  const sourceBase='https://github.com/adnanwahab/happybearlandia/blob/f17af6f734badd0125fa32dde2f62509e0f46f4e/';
  for(const [heading,text,path,label] of [
    ['A synthetic city, not a forecast','Riverside is an invented city with no real geographic coordinates. Two futures start from the same city and run for 120 modeled months. The calendar is illustrative. Results are uncalibrated model outcomes, not predictions of real rents, residents or policy effects.','world/future-machine/data/README.md','City setup and data sources'],
    ['What the model assumes','The monthly City model uses rules for housing, households, jobs, transport, utilities, construction and budgets. This demo assumes no private parcel capacity, utility capacity 200 per district and network, and zero annual growth. The default plan requests 24 homes for 1,000,000 modeled USD; these are scenario inputs, not real construction estimates.','world/future-machine/contracts.js','Default scenario inputs'],
    ['What the numbers leave out','Rules are coarse substitutes for real behavior, including district service coverage and aggregate business demand. Mean unit rent covers the whole housing stock, so adding differently priced homes can change the average without changing an existing tenant’s rent. Link travel time is not a resident’s commute. Missing measurements remain unavailable. A difference between futures is conditional on these rules and assumptions.','world/city/README.md','Model rules and limitations'],
    ['Seeds and fair comparisons','A seed fixes the model’s random choices. Both futures use the same starting city and seed, with the selected plan applied to one arm. Repeating a recipe requires the same model version and inputs. One paired run does not measure the range of possible outcomes or establish a real-world causal effect. The provenance line shows the displayed run; changing “Seed for next run” takes effect after Fork City.','world/future-machine/data/README.md','Matched runs and replay contract'],
    ['Replay and evidence','Comparison links include the versioned recipe, saved experiment ID and selected month. Detailed monthly states are recomputed from the saved manifest, not independently verified stored checkpoints. Ordinary comparison links explicitly rerun a missing saved record from its recipe; imported receipts and shared questions require the exact saved run and fail if unavailable. Incompatible versions fail rather than silently upgrade. WHY and Export evidence expose recorded events and inputs; this adapter has no causal trace records, so explanations do not prove causation.','docs/future-machine-storage.md','Storage and replay limits'],
  ]) {
    const section=node('section');const link=node('a',label);link.href=sourceBase+path;link.target='_blank';link.rel='noopener noreferrer';link.append(node('span',' (source, opens in new tab)'));
    section.append(node('h2',heading),node('p',text),link);explanation.append(section);
  }
  shell.append(explanation);
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
  timeline.append(date,slider,ticks,transport,node('p','Focus the city canvas: Page Up advances one year; Page Down retreats one year; D jumps to the first recorded divergence (including policy or nonphysical changes). Years stop at Months 0 and 120.','fm-detail')); shell.append(timeline);
  const cards=node('section',undefined,'fm-metrics'); cards.setAttribute('aria-label','Measured outcomes');cards.dataset.testid='future-machine-metrics';
  const metricNodes={};
  for(const [key,label] of [['homes','Homes'],['rent','Mean unit rent'],['spending','City spending']]) {
    const card=node('article',undefined,'fm-card'), delta=node('strong'), values=node('p'), detail=node('p',undefined,'fm-detail'), badge=node('button',undefined,'fm-provenance-badge'); badge.type='button';
    const sourceDetail=node('p',undefined,'fm-detail');sourceDetail.hidden=true;badge.setAttribute('aria-expanded','false');listen(badge,'click',()=>{sourceDetail.hidden=!sourceDetail.hidden;badge.setAttribute('aria-expanded',String(!sourceDetail.hidden));});
    const why=button(`WHY · ${label}`,()=>action(options.onMetric,key)); why.className='fm-metric-why'; why.disabled=true;
    card.append(node('h2',label),delta,values,badge,sourceDetail,detail,why); cards.append(card); metricNodes[key]={card,delta,values,badge,sourceDetail,detail,why};
  }
  shell.append(cards,node('p','Differences are WITH PLAN − WITHOUT PLAN at the selected month. Capital spending is cumulative cost, not a welfare gain; homes count recorded housing units. One paired synthetic run uses a shared seed, not an uncertainty interval. Uncalibrated assumptions and seed variation can change results; these values are not an empirical forecast.','fm-detail fm-metric-limits'));
  const inspectors=node('section',undefined,'fm-inspectors');
  const householdPanel=node('section',undefined,'fm-household-legacy'), household=node('select'), householdBody=node('pre');
  const householdSummaryNode=node('p',undefined,'fm-household-summary'),householdRaw=node('details');householdRaw.append(node('summary','Inspect exact household records'),householdBody); household.setAttribute('aria-label','Monthly City household');
  householdPanel.append(node('h2','Household outcomes'),household,householdSummaryNode,householdRaw);
  const evidencePanel=node('section'), evidence=node('pre'); const evidenceRaw=node('details');evidenceRaw.append(node('summary','Inspect run and comparison record'),evidence);evidencePanel.append(node('h2','Evidence inspector'),node('p','Click a changed building or WHY on a measured outcome to inspect its recorded event, policy and model rule.'),evidenceRaw);
  inspectors.append(householdPanel,evidencePanel); shell.append(inspectors);
  const footer=node('footer',undefined,'fm-actions');
  const share=button('Copy comparison link',()=>action(options.onShare)); const exportButton=button('Export evidence',()=>action(options.onExport));
  const importLink=node('a','Import run receipt'); importLink.href='/world/future-machine/share/import.html';
  const cardButton=button('Download share card',()=>action(options.onCard));
  footer.append(share,exportButton,cardButton,importLink); shell.append(footer); root.append(shell);
  const readiness=mountControlReadiness(doc, control => {
    if(state.busy)return 'Loading or running matched futures. Wait for completion or cancel the run.';
    if(control===fork)return 'Choose an available city and supported plan to run a comparison.';
    if(control===household)return 'No household observations are recorded for this month. Select another month.';
    if(!state.ready)return 'Run a comparison or reopen a saved replay to explore recorded months and evidence.';
    return 'This action has no recorded data or supported handler in this view. Select another month or outcome.';
  },shell);
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
    event.preventDefault(); if((state.busy && !state.preview) || !options.onFork)return;
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
    city.disabled=policy.disabled=state.busy && !state.preview;
    fork.disabled=(state.busy && !state.preview) || !state.cities.length || !state.policies.length || !options.onFork;
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
    for(const key of Object.keys(metricNodes)){const item=metricPresentation(state.metrics?.[key]); const elements=metricNodes[key];const provenance=provenancePresentation(state.metrics?.[key]?.provenance);elements.sourceDetail.textContent=provenance.description;elements.badge.textContent=provenance.label;elements.badge.title=provenance.description;elements.badge.setAttribute('aria-label',provenance.description);elements.badge.dataset.category=provenance.category;elements.card.title=provenance.description;elements.delta.textContent=item.delta;elements.values.replaceChildren(node('span',`WITHOUT PLAN  ${item.baseline}`,'fm-value-baseline'),node('span',`WITH PLAN  ${item.intervention}`,'fm-value-plan'));const semantics=metricSemantics(key,state.metrics?.[key]);elements.card.dataset.tone=semantics.tone;elements.detail.textContent=key==='rent' && semantics.tone==='neutral' && item.delta!=='Unavailable' ? `${semantics.label}.` : `${semantics.label}. ${item.detail}`;elements.why.disabled=!state.ready || state.busy || !options.onMetric || item.delta==='Unavailable';}
    if(patch.households && JSON.stringify(patch.households)!==JSON.stringify(old.households)){fill(household,state.households,state.householdId ?? household.value);renderHousehold();}
    household.disabled=!state.households.length;
    if('householdId' in patch){household.value=state.householdId;renderHousehold();}
    if('evidence' in patch)evidence.textContent=state.evidence ? JSON.stringify(state.evidence,null,2) : 'No recorded evidence selected.';
    if(!evidence.textContent)evidence.textContent='No recorded evidence selected.';
    if(!householdBody.textContent)renderHousehold();
    cardButton.disabled=!state.ready || state.busy || !options.onCard;share.disabled=!state.ready || state.busy || !options.onShare;exportButton.disabled=!state.ready || state.busy || !options.onExport;
    readiness.update();
    if(old.month!==state.month)options.onRenderMonth?.(state.month);
  }
  update(state);
  return {stage,update,getState:()=>({...state}),pause,destroy(){readiness.dispose();destroyed=true;generation++;pause();listeners.forEach(remove=>remove());shell.remove();}};
}

/** Frozen interface v1 adapter. The coordinator owns simulation, playback, and scene rendering. */
export function createUI(container, callbacks = {}) {
  let current={status:'idle',month:0,playing:false,mode:'split',ghosts:true};
  let recipe=structuredClone(DEFAULT_RECIPE), configurationDirty=false;
  const familyHost=container.ownerDocument.createElement("div");
  const family=mountFamilyCard(familyHost,{onFollow:callbacks.onFollowFamily});
  const view=mountFutureMachineUI(container,{
    externalPlayback:true,
    onFork:()=>{if(!configureSeed())throw new Error(seedError.textContent);if(!configureAmount())throw new Error(amountInput.validationMessage);return callbacks.onRun?.(structuredClone(recipe));},
    onMonthChange:month=>callbacks.onMonth?.(month),
    onPlay:value=>callbacks.onPlay?.(value),
    onBlink:value=>callbacks.onMode?.(value?'plan':'baseline'),
    onShowChanges:callbacks.onDirector,
    onShare:callbacks.onShare,
    onExport:callbacks.onExport,
    onCard:callbacks.onCard,
    onCancel:callbacks.onCancel,
    onMetric:callbacks.onMetric ? key=>callbacks.onMetric({homes:'housingUnits',commute:'meanTravelMinutes',rent:'meanRent',spending:'capitalSpending'}[key]) : undefined,
    onPolicyChange:id=>{recipe={...recipe,intervention:structuredClone(policyChoices(recipe.intervention).find(choice=>choice.id===id).intervention)};syncAmount();configurationDirty=true;callbacks.onConfigure?.(structuredClone(recipe));},
  });
  const doc=container.ownerDocument;
  const shell=view.stage.closest('.fm-ui');
  const catalog=doc.createElement('details');
  const summary=doc.createElement('summary');summary.textContent='Three playable what-if recipes';catalog.append(summary);
  for(const entry of PLAYABLE_RECIPES){
    const item=doc.createElement('article'),link=doc.createElement('a'),description=doc.createElement('p'),limits=doc.createElement('p');
    link.textContent=entry.title;link.href=createShareURL({recipe:entry.recipe,month:120},doc.location.href);
    description.textContent=entry.description;
    limits.textContent=`${entry.source} ${entry.limitations} Seed ${entry.recipe.seed} · ${entry.recipe.modelVersion} · ${entry.datasetVersion} · ${entry.catalogVersion}. Recomputed from this versioned recipe; export evidence after running.`;
    item.append(link,description,limits);catalog.append(item);
  }
  shell.querySelector('.fm-setup').before(catalog);

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
  const reset=doc.createElement('button');reset.type='button';reset.textContent='Reset to original';reset.dataset.testid='future-machine-reset';
  reset.title='Restore the original seed and policy. Keep displayed results; Fork City reruns on demand.';
  reset.onclick=()=>{
    if(reset.disabled)return;
    recipe=structuredClone(current.originalRecipe || DEFAULT_RECIPE);configurationDirty=false;
    syncAmount();
    seedInput.value=String(recipe.seed);seedInput.setCustomValidity('');seedInput.setAttribute('aria-invalid','false');seedError.hidden=true;
    callbacks.onReset?.();
    update({});
  };
  shell.querySelector('.fm-setup').append(reset);


  const amountLabel=doc.createElement('label');amountLabel.className='fm-seed-label';amountLabel.textContent='Proposed homes for next run';
  const amountInput=doc.createElement('input');amountInput.type='number';amountInput.min='1';amountInput.max='120';amountInput.step='1';amountInput.required=true;amountInput.value=String(recipe.intervention.amount);amountInput.setAttribute('aria-label','Proposed homes for next run');
  const amountHelp=doc.createElement('small');amountHelp.textContent='1–120 proposed homes. Cost, district and timing stay fixed; construction constraints apply. Fork City reruns from the same seed and initial conditions unless you change the seed. Displayed results stay unchanged until completion.';
  amountLabel.append(amountInput,amountHelp);shell.querySelector('.fm-setup').insertBefore(amountLabel,shell.querySelector('.fm-setup button'));
  function syncAmount(){amountInput.value=recipe.intervention?.type==='housing'?String(recipe.intervention.amount):'';amountInput.setCustomValidity('');amountInput.setAttribute('aria-invalid','false');}
  function configureAmount(){
    if(!recipe.intervention || recipe.intervention.type!=='housing')return true;
    const amount=Number(amountInput.value),valid=amountInput.value!=='' && Number.isInteger(amount) && amount>=1 && amount<=120;
    amountInput.setCustomValidity(valid?'':'Proposed homes must be a whole number from 1 through 120.');amountInput.setAttribute('aria-invalid',String(!valid));
    if(!valid){configurationDirty=true;return false;}
    if(amount!==recipe.intervention.amount){recipe={...recipe,intervention:{...recipe.intervention,amount}};configurationDirty=true;callbacks.onConfigure?.(structuredClone(recipe));}
    return true;
  }
  amountInput.oninput=configureAmount;

  const storyElement=doc.createElement('section');storyElement.className='fm-story';storyElement.dataset.testid='future-machine-why';storyElement.setAttribute('aria-label','Recorded change story');shell.querySelector('.fm-inspectors').after(storyElement);
  const actions=shell.querySelector('.fm-timeline .fm-actions');
  const demoPanel=doc.createElement('section');demoPanel.className='fm-demo';demoPanel.setAttribute('aria-label','Guided demo');
  const demo=doc.createElement('button');demo.type='button';demo.className='fm-primary fm-demo-play';demo.textContent='Play Demo';demo.dataset.testid='future-machine-demo';demo.onclick=()=>callbacks.onDemo?.();
  const demoPause=doc.createElement('button');demoPause.type='button';demoPause.textContent='Pause demo';demoPause.onclick=()=>callbacks.onDemoPause?.();demoPause.hidden=true;
  const demoCaption=doc.createElement('p');demoCaption.className='fm-demo-caption';demoCaption.setAttribute('role','status');demoCaption.textContent='A guided 45–60 second comparison. Pause anytime to explore.';
  const cameraLabel=doc.createElement('label');const autoCamera=doc.createElement('input');autoCamera.type='checkbox';autoCamera.checked=true;autoCamera.onchange=()=>callbacks.onAutoCamera?.(autoCamera.checked);cameraLabel.append(autoCamera,doc.createTextNode(' Automatic camera'));
  const demoSkip=doc.createElement('button');demoSkip.type='button';demoSkip.textContent='Skip demo';demoSkip.hidden=true;demoSkip.onclick=()=>callbacks.onDemoSkip?.();
  const demoSeconds=doc.createElement('span');demoSeconds.className='fm-demo-seconds';
  const demoManual=doc.createElement('button');demoManual.type='button';demoManual.textContent='Take manual control';demoManual.onclick=()=>callbacks.onDemoManual?.();demoManual.hidden=true;
  demoPanel.append(demo,demoPause,demoSkip,demoManual,cameraLabel,demoCaption,demoSeconds);shell.querySelector('.fm-header').after(demoPanel);
  const recentPanel=doc.createElement('section');recentPanel.className='fm-demo';recentPanel.setAttribute('aria-label','Local continuation');
  const remember=doc.createElement('button');remember.type='button';remember.textContent='Remember this comparison';remember.onclick=()=>callbacks.onRemember?.();
  const clear=doc.createElement('button');clear.type='button';clear.textContent='Clear saved comparison';clear.onclick=()=>callbacks.onClearRecent?.();
  const recentHelp=doc.createElement('p');recentHelp.textContent='Opt in to continue where you left off on this browser. Saves only the synthetic recipe, run reference and selected month; no private user details.';
  const recentStatus=doc.createElement('p');recentStatus.setAttribute('role','status');
  recentPanel.append(remember,clear,recentHelp,recentStatus);demoPanel.after(recentPanel);
  const runProvenance=doc.createElement('p');runProvenance.className='fm-run-provenance';runProvenance.setAttribute('aria-label','Simulation provenance');shell.querySelector('.fm-comparison').before(runProvenance);
  const difference=doc.createElement('button');difference.type='button';difference.textContent='Difference-only';difference.onclick=()=>callbacks.onMode?.('difference');actions.append(difference);
  const split=doc.createElement('button');split.type='button';split.textContent='Side by side';split.onclick=()=>callbacks.onMode?.('split');actions.append(split);
  const ghostsLabel=doc.createElement('label');const ghosts=doc.createElement('input');ghosts.type='checkbox';ghosts.checked=true;ghosts.onchange=()=>callbacks.onGhosts?.(ghosts.checked);ghostsLabel.append(ghosts,doc.createTextNode(' Ghost differences'));actions.append(ghostsLabel);
  const browserShare=doc.createElement('button');browserShare.type='button';browserShare.textContent='Share comparison';browserShare.hidden=!callbacks.onBrowserShare;browserShare.onclick=()=>callbacks.onBrowserShare?.();shell.querySelector('footer').append(browserShare);
  const copyLabel=doc.createElement('label');copyLabel.textContent='Comparison URL';copyLabel.className='fm-copy-url';copyLabel.hidden=true;
  const copyURL=doc.createElement('input');copyURL.type='text';copyURL.readOnly=true;copyURL.setAttribute('aria-label','Comparison URL');copyURL.onfocus=()=>copyURL.select();copyLabel.append(copyURL);shell.append(copyLabel);
  const retry=doc.createElement('button');retry.type='button';retry.textContent='Retry comparison';retry.hidden=true;retry.onclick=()=>callbacks.onRetry?.();shell.querySelector('.fm-setup').append(retry);
  const shareLink=doc.createElement('a');shareLink.textContent='Open comparison link';shareLink.hidden=true;shareLink.className='fm-share-link';shell.append(shareLink);
  const inputSummaries=['baseline','plan'].map(arm=>{
    const box=doc.createElement('div');box.className='fm-arm-inputs';box.dataset.testid=`future-machine-inputs-${arm}`;
    box.setAttribute('aria-label',`${arm==='baseline'?'Without plan':'With plan'} comparison inputs`);
    const heading=doc.createElement('span');heading.className='fm-arm-heading';heading.textContent=arm==='baseline'?'WITHOUT PLAN':'WITH PLAN';
    shell.querySelector('.fm-legends').children[arm==='baseline'?0:1].replaceChildren(heading,box);
    return box;
  });
  const firstConstruction=doc.createElement('aside');firstConstruction.className='fm-first-construction';firstConstruction.hidden=true;firstConstruction.setAttribute('aria-label','First recorded construction');
  const constructionText=doc.createElement('strong');const constructionWhy=doc.createElement('button');constructionWhy.type='button';constructionWhy.textContent='Inspect WHY';constructionWhy.onclick=()=>callbacks.onFirstConstruction?.();
  firstConstruction.append(constructionText,constructionWhy);view.stage.before(firstConstruction);
  const previewOpen=doc.createElement('button');previewOpen.type='button';previewOpen.textContent='Preview comparison link';previewOpen.onclick=()=>callbacks.onPreviewShare?.();shell.querySelector('footer').append(previewOpen);
  const preview=doc.createElement('section');preview.hidden=true;preview.setAttribute('aria-label','Comparison permalink preview');
  const previewTitle=doc.createElement('h2');previewTitle.textContent='Comparison permalink preview';previewTitle.tabIndex=-1;
  const previewText=doc.createElement('pre');previewText.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere';
  const previewLink=doc.createElement('a');previewLink.textContent='Open previewed comparison';
  const copyShare=doc.createElement('button');copyShare.type='button';copyShare.textContent='Copy previewed link';copyShare.onclick=()=>callbacks.onCopyShare?.();
  preview.append(previewTitle,previewText,previewLink,copyShare);shell.append(preview);
  const noPhysical=doc.createElement('p');noPhysical.className='fm-detail';shell.querySelector('.fm-metrics').after(noPhysical);
  function update(patch={}) {
    const previousExperiment=current.experimentId ?? current.provenance?.experimentId;
    const previousPreview=current.sharePreview;
    current={...current,...patch,...(patch.demo?{demo:{...current.demo,...patch.demo}}:{}),...(patch.provenance?{provenance:{...current.provenance,...patch.provenance}}:{})};
    if(patch.recipe){
      const incomingExperiment=current.experimentId ?? current.provenance?.experimentId;
      const accepted=seedInput.getAttribute('aria-invalid')!=='true' && amountInput.getAttribute('aria-invalid')!=='true' && JSON.stringify(patch.recipe)===JSON.stringify(recipe);
      if(!configurationDirty || accepted || (previousExperiment && incomingExperiment && previousExperiment!==incomingExperiment)){
        recipe=structuredClone(patch.recipe);configurationDirty=false;seedInput.value=String(recipe.seed);seedError.hidden=true;seedInput.setCustomValidity('');seedInput.setAttribute('aria-invalid','false');
        syncAmount();
      }
    }
    retry.hidden=current.status!=='error' || !callbacks.onRetry || current.canRetry===false;
    const busy=['loading','running','queued'].includes(current.status),configurationBusy=busy && !current.preview;seedInput.disabled=configurationBusy;amountInput.disabled=configurationBusy || recipe.intervention?.type!=='housing';
    autoCamera.checked=current.autoCamera!==false;
    reset.disabled=configurationBusy || !callbacks.onReset;
    const demoState=current.demo || {};
    const demoActive=['playing','running','paused','preparing','loading'].includes(demoState.status);
    demo.disabled=!callbacks.onDemo;demo.textContent=demoActive?'Restart Demo':demoState.status==='complete'?'Replay Demo':'Play Demo';demoSkip.hidden=!demoActive;demoSkip.disabled=busy || demoState.status==='preparing' || !callbacks.onDemoSkip;
    demoPause.hidden=!demoActive;demoPause.disabled=!callbacks.onDemoPause;demoPause.textContent=demoState.paused?'Resume demo':'Pause demo';demoPause.setAttribute('aria-pressed',String(!!demoState.paused));
    demoManual.hidden=!demoActive;demoManual.disabled=!callbacks.onDemoManual;
    const caption=demoState.caption || (demoState.status==='complete'?'Demo complete. Scrub the timeline or select a result to explore.':'A guided 45–60 second comparison. Pause anytime to explore.');
    if(demoCaption.textContent!==caption)demoCaption.textContent=caption;
    demoSeconds.textContent=Number.isFinite(demoState.elapsedMs)?`${Math.floor(Math.max(0,demoState.elapsedMs)/1000)}s`:'';
    const provenance=current.provenance || {};
    runProvenance.textContent=(current.preview?'INITIAL SNAPSHOT · Synthetic model inventory · Future results unavailable · ':'')+`MONTH ${current.month} / 120 · SEED ${provenance.seed ?? current.recipe?.seed ?? 'Unavailable'} · MODEL ${provenance.modelVersion ?? current.recipe?.modelVersion ?? 'Unavailable'} · RUN ${provenance.experimentId ?? current.experimentId ?? 'Not run yet'}`;
    const displayed=current.comparisonRecipe;
    const initialHouseholds=current.comparisonInitial?.households;
    const people=initialHouseholds?.every(row=>Number.isFinite(row.size)) ? initialHouseholds.reduce((sum,row)=>sum+row.size,0) : null;
    const value=(number,unit='')=>number==null?'Unavailable':`${number}${unit}`;
    for(const [index,box] of inputSummaries.entries()){
      const intervention=displayed?.intervention;
      const policy=!displayed?'Policy: Unavailable':index===0 || !intervention?'Policy: no intervention · 0 added homes · 0 USD intervention cost':`Policy: ${intervention.type} · district ${intervention.districtId} · ${value(intervention.amount,' proposed homes')} · ${value(intervention.cost,' illustrative USD')} · delay ${value(intervention.delay,' months')} · compliance ${value(intervention.compliance)}`;
      box.textContent=`Seed ${value(displayed?.seed)} · Horizon ${value(displayed?.months,' months')} · Starting population ${value(people,' people')} (${value(displayed?.households,' households')}) · ${policy}`;
    }
    const ready=!!current.frame && !busy && !current.preview;
    remember.disabled=!ready || current.status!=='ready' || !callbacks.onRemember;remember.textContent=current.remembering?'Local continuation enabled':'Remember this comparison';remember.setAttribute('aria-pressed',String(!!current.remembering));
    clear.disabled=!callbacks.onClearRecent;recentStatus.textContent=current.recentMessage || 'Local continuation is off.';
    const metrics={};
    for(const [key,source] of [['homes','housingUnits'],['rent','meanRent'],['spending','capitalSpending']]){
      const metric=current.preview?null:current.diff?.metrics?.[source];
      metrics[key]=metric?{provenance:MONTHLY_CITY_PROVENANCE,...comparisonMetric(metric),note:key==='rent'?'All recorded units, including new inventory; not incumbent rent savings.':key==='spending'?'Cumulative capital spending in USD; cost is not a welfare gain.':undefined}:null;
    }
    family.update(current);
    const a=current.frame?.baseline?.state?.households||[],b=current.frame?.plan?.state?.households||[];
    const ids=[...new Set([...a,...b].map(row=>row.id))].sort();
    const households=ids.map(id=>({id,label:`City household ${id}`,baseline:a.find(row=>row.id===id)??null,plan:b.find(row=>row.id===id)??null,baselineHousing:householdObservation(a.find(row=>row.id===id),current.frame?.baseline?.state?.units),planHousing:householdObservation(b.find(row=>row.id===id),current.frame?.plan?.state?.units)}));
    view.update({busy,ready,preview:current.preview,month:current.month,playing:current.playing,status:current.message,error:current.error,metrics,households,
      cities:[{id:'synthetic',label:'Riverside · Synthetic City'}],
      policies:policyChoices(recipe.intervention),
      policyId:policyId(recipe.intervention),spatialLabel:'Synthetic schematic layout · Monthly City model · January 2026–January 2036 · Uncalibrated assumptions. No real-world geometry inferred. Private parcel capacity 0; utility capacity 200 per district/network; annual growth 0.',
      blink:current.mode==='plan',evidence:current.diff?{month:current.month,experimentId:current.experimentId,changedCount:current.diff.changedCount,physicalCount:current.diff.physicalCount,source:'Monthly City comparison. Select an entity for recorded evidence.'}:null,
    });
    const cue=firstConstructionLabel(current);
    firstConstruction.hidden=cue===null;constructionText.textContent=cue??'';
    constructionWhy.disabled=!callbacks.onFirstConstruction;
    noPhysical.textContent=current.diff ? (current.diff.available===false?'Comparison unavailable for this month.':current.diff.physicalCount===0?'No physical building or link difference recorded at this month.':'Physical changes are recorded; inspect the highlighted entities for evidence.') : '';
    // Only describe a matched start when a complete comparison supports it.
    const identicalStart=current.month===0 && current.diff?.available===true && current.diff.changedCount===0 && Object.values(current.diff.metrics || {}).length>0 && Object.values(current.diff.metrics).every(metric=>Number.isFinite(metric.baseline) && Number.isFinite(metric.plan) && metric.baseline===metric.plan && metric.delta===0);
    const legends=shell.querySelector('.fm-legends');
    legends.children[0].querySelector('.fm-arm-heading').textContent=`WITHOUT PLAN${identicalStart?' · Identical starting state':''}`;
    legends.children[1].querySelector('.fm-arm-heading').textContent=`WITH PLAN${identicalStart?' · Identical starting state':''}`;
    difference.disabled=split.disabled=ghosts.disabled=!ready;difference.setAttribute('aria-pressed',String(current.mode==='difference'));split.setAttribute('aria-pressed',String(current.mode==='split'));ghosts.checked=current.ghosts;
    browserShare.disabled=!ready || !!current.shareBusy;
    shell.querySelector('footer button').disabled=!ready || !!current.shareBusy || !callbacks.onShare;
    copyLabel.hidden=true;copyURL.value='';
    previewOpen.disabled=!ready||!!current.shareBusy||!callbacks.onPreviewShare;
    preview.hidden=!current.sharePreview;
    if(current.sharePreview){
      const {context,url}=current.sharePreview;
      previewText.textContent=`Synthetic monthly City scenario · baseline vs plan\nSeed ${context.recipe.seed} · Month ${context.month}\nSaved experiment: ${context.experimentId??'none'}\nInputs: ${JSON.stringify(context.recipe,null,2)}\nLanding: ${JSON.stringify(context.landing,null,2)}\nOpens paused in Future Machine. Ordinary missing records recompute the pinned recipe; receipt-backed questions require the exact saved run; this is not verified checkpoint recovery. Camera restoration requires a compatible renderer.`;
      let validURL=false;try{const parsed=new URL(url,doc.baseURI);if(['http:','https:'].includes(parsed.protocol)){previewLink.href=parsed.href;validURL=true;}}catch{}
      previewLink.hidden=!validURL;if(!validURL)previewLink.removeAttribute('href');copyShare.disabled=!validURL||!ready||!!current.shareBusy||!callbacks.onCopyShare;
      if(current.sharePreview!==previousPreview)previewTitle.focus();
    }
    shareLink.hidden=!current.shareURL;
    if(current.shareURL){try{const url=new URL(current.shareURL,doc.baseURI);if(['http:','https:'].includes(url.protocol)){shareLink.href=url.href;copyURL.value=url.href;copyLabel.hidden=false;}else{shareLink.removeAttribute('href');shareLink.hidden=true;}}catch{shareLink.removeAttribute('href');shareLink.hidden=true;}}
  }
  view.stage.after(familyHost);
  container.querySelector('.fm-household-legacy').hidden=true;
  return {stageElement:view.stage,storyElement,update,dispose(){family.dispose();familyHost.remove();copyShare.onclick=null;previewOpen.onclick=null;reset.onclick=null;autoCamera.onchange=null;retry.onclick=null;constructionWhy.onclick=null;remember.onclick=null;clear.onclick=null;amountInput.oninput=null;browserShare.onclick=null;copyURL.onfocus=null;seedInput.oninput=null;demo.onclick=null;demoPause.onclick=null;demoSkip.onclick=null;demoManual.onclick=null;difference.onclick=null;split.onclick=null;ghosts.onchange=null;view.destroy();}};
}
