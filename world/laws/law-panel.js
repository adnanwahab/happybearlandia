import {LAW_CATALOG} from './catalog.js';
import {compareLawInWorker as compareLawDefault} from './comparison-client.js';
/** mountLawPanel(container,{laws,compareLaw,getContext,onSelect,onPlanIdeaChange,
 * planInput,worldLayer,onError}) -> {open,close,selectLaw,setLaws,destroy}.
 * getContext() returns comparison options {worldContext|initialState,seed,population,minutes?|months?}.
 * compareLaw(law,{...context,signal}) returns recorded paired model outputs. */
export function groupLawCatalog(laws=[]){
 const groups=new Map();
 for(const law of laws){
  const number=Number(law.number??String(law.id??'').match(/\d+/)?.[0]);
  if(!Number.isInteger(number)||number<11||number>100)continue;
  const group=law.group?.title??law.group?.label??law.groupTitle??law.category??(typeof law.group==='string'?law.group:'Laws');
  if(!groups.has(group))groups.set(group,[]);
  groups.get(group).push({...law,number});
 }
 return [...groups].map(([title,rows])=>({title,laws:rows.sort((a,b)=>a.number-b.number)}));
}
export function lawComparisonRows(result){
 const source=result?.scorecard??result?.metrics??result?.deltas??result?.changes??[];
 const rows=Array.isArray(source)?source:Object.entries(source||{}).map(([id,row])=>({id,...(row&&typeof row==='object'?row:{delta:row})}));
 return rows.filter(row=>row&&typeof row==='object').map(row=>({label:row.label??row.metric??row.id??'Recorded metric',baseline:row.baseline??row.without??row.before??null,current:row.current??row.selected??row.with??row.after??null,delta:result?.comparable===false||result?.comparison?.comparable===false?null:row.delta??null,unit:row.unit??''}));
}
export function hasRecordedLawGeography(result){
 const visual=result?.visual??result?.recordedChanges??{};
 return ['recordedBuildingIds','recordedRoadIds','recordedPersonIds','buildingIds','roadIds','personIds'].some(key=>Array.isArray(visual[key])&&visual[key].length>0);
}
export function mountLawPanel(container,options={}){
 if(container?.container){options=container;container=options.container;}
 if(!container?.ownerDocument)throw new TypeError('Law panel requires a container');
 const {compareLaw=(law,context)=>compareLawDefault({...context,lawId:law.id??law.number}),getContext=()=>({}),onSelect,onPlanIdeaChange,planInput,worldLayer,onError}=options,doc=container.ownerDocument,win=doc.defaultView;
 let laws=options.laws??options.catalog?.laws??options.catalog??LAW_CATALOG,selected=null,comparison=null,request=0,abort=null,destroyed=false;
 const root=doc.createElement('section');root.className='law-panel';root.hidden=true;root.dataset.testid='law-panel';root.setAttribute('role','dialog');root.setAttribute('aria-label','Choose a law');root.setAttribute('data-map-pan-ignore','');
 const toggle=doc.createElement('button');toggle.type='button';toggle.className='law-panel-toggle';toggle.textContent='Choose a law';toggle.dataset.testid='law-panel-button';toggle.setAttribute('aria-haspopup','dialog');toggle.setAttribute('aria-expanded','false');
 const sheet=doc.createElement('link');sheet.rel='stylesheet';sheet.href=new URL('./law-panel.css',import.meta.url).href;(doc.head||container).append(sheet);container.append(toggle,root);
 const el=(tag,text,parent=root)=>{const node=doc.createElement(tag);if(text!==undefined)node.textContent=text;parent.append(node);return node;};
 const button=(label,fn,parent=root)=>{const node=el('button',label,parent);node.type='button';node.addEventListener('click',fn);return node;};
 const header=el('header');el('h2','Choose a law',header);button('Close',close,header);
 el('p','Explore 90 proposals. Choose a law to replace Plan idea, compare the same world with and without it, and highlight affected places.');
 const label=el('label','Find a law'),search=el('input',undefined,label);search.type='search';search.placeholder='Number or words';search.setAttribute('aria-label','Find a law');
 const count=el('p'),list=el('div');list.className='law-groups';count.setAttribute('aria-live','polite');
 const detail=el('section');detail.className='law-detail';detail.hidden=true;
 const heading=el('h3','',detail),text=el('p','',detail),ideaLabel=el('label','Plan idea',detail),idea=el('textarea',undefined,ideaLabel),status=el('p','',detail);idea.rows=4;idea.readOnly=true;idea.setAttribute('aria-label','Plan idea');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const scope=el('p','',detail);scope.className='law-note';
 const actions=el('div',undefined,detail);const compareButton=button('Compare this law',()=>runComparison(),actions);button('Relevant institutions',()=>paint('potential'),actions);const recordedButton=button('Highlight modeled changes',()=>paint('recorded'),actions);recordedButton.disabled=true;button('Clear highlights',()=>worldLayer?.clear?.(),actions);
 const traceBox=el('div',undefined,detail);traceBox.dataset.testid='law-mechanism-trace';
 const table=el('table',undefined,detail),notes=el('ul',undefined,detail);table.setAttribute('aria-label','Same-world with and without law comparison');
 function renderList(){
  list.replaceChildren();let matches=0;const query=search.value.trim().toLocaleLowerCase();
  for(const group of groupLawCatalog(laws)){const rows=group.laws.filter(law=>(law.number+' '+(law.text??law.title??'')).toLocaleLowerCase().includes(query));if(!rows.length)continue;
   const section=el('details',undefined,list);section.open=Boolean(query)||group.laws.some(law=>law.number===selected?.number)||(!selected&&matches===0);el('summary',group.title+' ('+rows.length+')',section);
   for(const law of rows){const choice=button(law.number+'. '+(law.text??law.title??''),()=>selectLaw(law),section);choice.title=law.supported?'Paired simulation available':'Institution scope available; simulation mechanism not yet supported';choice.dataset.lawId=String(law.id??law.number);choice.setAttribute('aria-pressed',String(selected?.number===law.number));matches++;}
  }count.textContent=matches+' matching laws';
 }
 function paint(mode='potential'){
  const report=worldLayer?.update?.({law:selected,comparison,context:getContext(),mode});
  scope.dataset.mode=mode;
  scope.textContent=report?.summary??(mode==='recorded'?'Recorded geography requires explicit affected entity IDs from the comparison.':'Potential institution scope is distinct from modeled effects.');
 }
 function format(value,unit){return typeof value==='number'&&Number.isFinite(value)?value.toLocaleString(undefined,{maximumFractionDigits:3})+(unit?' '+unit:''):typeof value==='string'?value:'Unavailable';}
 function renderTrace(result){
  traceBox.replaceChildren();const trace=result?.mechanismTrace,contract=trace?.contract??selected?.mechanismContract;
  if(!contract)return;const box=el('details',undefined,traceBox);el('summary','Law → mechanism → behavior → measured outcome',box);
  el('p',contract.status+' · '+(contract.leverTypes??[]).join(', '),box);
  const chain=el('ol',undefined,box);for(const stage of contract.chain??[])el('li',stage.kind+' · '+stage.status+' · '+stage.description,chain);
  for(const lever of contract.levers??[]){const item=el('details',undefined,box);el('summary',lever.parameter.key+' · '+lever.types.join(', '),item);const evidence=trace?.parameterEvidence?.find(row=>row.leverId===lever.id);el('p','Parameter: '+lever.parameter.operation+' '+JSON.stringify(lever.parameter.value)+' '+lever.parameter.unit,item);el('p','Consumed by: '+lever.consumers.map(row=>row.file+' · '+row.symbol).join('; '),item);el('p','State: '+lever.statePaths.join(', '),item);if(evidence)el('p','Recorded input: '+JSON.stringify(evidence.baseline)+' → '+JSON.stringify(evidence.selected)+' · '+evidence.status,item);}
  if(trace?.measurements?.length){const measurements=el('table',undefined,box),head=el('tr',undefined,measurements);for(const label of ['Recorded outcome','Without','With','Change'])el('th',label,head);for(const m of trace.measurements){const row=el('tr',undefined,measurements);for(const value of [m.metricId+' · '+m.unit,format(m.baseline),format(m.selected),format(m.delta)])el('td',value,row);}}
  el('p',trace?.execution?.status==='completed'?'Recorded outputs come from this paired run. The implementation chain does not prove that every intermediate stage activated.':'No completed execution evidence for this law.',box);
  el('p','Missing outcomes remain unavailable. Changed inputs can produce unchanged outcomes; a modeled difference is not proof of real-world causality.',box);
 }
 function renderResult(result){
  renderTrace(result);table.replaceChildren();notes.replaceChildren();const rows=lawComparisonRows(result);recordedButton.disabled=!hasRecordedLawGeography(result);
  if(rows.length){const head=el('thead',undefined,table),tr=el('tr',undefined,head);for(const name of ['Metric','Without law','With law','Modeled change'])el('th',name,tr);const body=el('tbody',undefined,table);for(const row of rows){const tr=el('tr',undefined,body);for(const value of [row.label,format(row.baseline,row.unit),format(row.current,row.unit),format(row.delta,row.unit)])el('td',value,tr);if(typeof row.delta==='number'&&row.delta!==0)tr.classList.add('law-metric-changed');}}
  else el('caption','No recorded numerical comparison is available.',table);
  for(const note of [...(selected?.mapping?.assumptions??[]),...(result?.limitations??[])])el('li',String(note),notes);
  if((result?.manifest?.seed??result?.seed)!==undefined)el('li','Paired seed: '+(result?.manifest?.seed??result.seed),notes);
  if(result?.manifest?.months!==undefined)el('li','Paired horizon: '+result.manifest.months+' months',notes);
  if(result?.manifest?.minutes!==undefined)el('li','Paired horizon: '+result.manifest.minutes+' modeled minutes',notes);
  if(result?.minute!==undefined)el('li','Selected simulation minute: '+result.minute,notes);
  status.textContent=result?.supported===false||result?.status==='unsupported'||result?.status==='mechanism-unavailable'?'Effects unavailable for this law in the current model. Potential institution scope can still be inspected.':result?.summary??'Comparison returned. Values above are supplied model outputs; missing values remain unavailable.';
 }
 function publishPlanIdea(law){const value=law.text??law.title??'';idea.value=value;if(planInput){planInput.value=value;planInput.dispatchEvent(new win.Event('input',{bubbles:true}));}onPlanIdeaChange?.(value,law);root.dispatchEvent(new win.CustomEvent('law-plan-idea',{bubbles:true,detail:{text:value,lawId:law.id??law.number}}));}
 async function runComparison(){
  if(!selected||destroyed)return;
  publishPlanIdea(selected);
  if(typeof compareLaw!=='function'){status.textContent='Comparison unavailable: no same-world comparison service is connected.';return;}
  const serial=++request;abort?.abort();abort=new AbortController();const law=selected,context=getContext();status.textContent='Comparing the same frozen world with and without this law…';renderTrace(null);table.replaceChildren();notes.replaceChildren();recordedButton.disabled=true;compareButton.disabled=true;detail.setAttribute('aria-busy','true');
  try{if(law.supported&&!context.initialState&&(!context.worldContext||!Object.keys(context.worldContext).length))throw Error('Current-world comparison context is not connected.');const result=await compareLaw(law,{...context,signal:abort.signal});if(destroyed||serial!==request)return;if(!result||typeof result!=='object')throw Error('Unsupported comparison response');comparison=result;renderResult(result);paint(hasRecordedLawGeography(result)?'recorded':'potential');}
  catch(error){if(destroyed||serial!==request||error.name==='AbortError')return;status.textContent='Comparison unavailable: '+error.message;onError?.(error);}
  finally{if(!destroyed&&serial===request){compareButton.disabled=false;detail.setAttribute('aria-busy','false');}}
 }
 function selectLaw(law){
  selected=law;comparison=null;detail.hidden=false;heading.textContent='Law '+law.number+' · '+(law.category??'Proposal');idea.value=law.text??law.title??'';text.textContent=law.supported?'Reviewed model mapping: '+(law.mapping?.mechanism??'partial proxy'):'Effects unavailable: no reviewed model mechanism.';
  publishPlanIdea(law);onSelect?.(law);renderList();paint('potential');detail.scrollIntoView?.({block:'start'});void runComparison();
 }
 root.insertBefore(detail,list);
 function open(){if(destroyed)return;root.hidden=false;toggle.setAttribute('aria-expanded','true');search.focus();}
 function close(){root.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.focus();}
 const click=()=>root.hidden?open():close(),keys=event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();close();}};
 toggle.addEventListener('click',click);search.addEventListener('input',renderList);root.addEventListener('keydown',keys);renderList();
 return{open,close,selectLaw,compareSelected:runComparison,getSelection:()=>selected,setLaws(next){laws=next;renderList();},destroy(){if(destroyed)return;destroyed=true;request++;abort?.abort();toggle.removeEventListener('click',click);search.removeEventListener('input',renderList);root.removeEventListener('keydown',keys);root.remove();toggle.remove();sheet.remove();worldLayer?.clear?.();}};
}
