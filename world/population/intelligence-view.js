import { summarizePopulationIntelligence, explainPopulationEntity, proposePopulationImport, runPopulationSensitivity } from './intelligence.js';
import { parsePopulationImport, IMPORT_KINDS } from './imports.js';
import { scoreObservedPopulation, proposeBehaviorCalibration, buildBehaviorModelCard, validatePopulationTargets, behaviorRangeWarnings } from './trust.js';
import { populationFactTables } from './intelligence-facts.js';
import { compareBehaviorActors } from '../analysis/behavior-deltas.js';
export function mountPopulationIntelligence({container,runtime,onProposeImport,onProposeCalibration,onSelectPerson}={}) {
  if(!container || !runtime) throw new Error('Population intelligence requires container and runtime.');
  const doc=container.ownerDocument; let snapshot=runtime.getSnapshot?.(), baseline=null, selected=null, selectedId=null, imported=null, scorecard=null, job=null, destroyed=false, request=0;
  let revision=snapshot?.runtime?.revision, renderTimer=null, lastRender=0, cardKey=null, cachedCard=null;
  const stylesheet=doc.createElement('link');stylesheet.rel='stylesheet';stylesheet.href=new URL('./intelligence.css',import.meta.url).href;rootStyleHost().append(stylesheet);
  function rootStyleHost(){return doc.head || container;}
  const root=doc.createElement('section');root.className='population-intelligence';container.append(root);
  const el=(tag,text,parent=root)=>{const node=doc.createElement(tag);if(text!==undefined)node.textContent=text;parent.append(node);return node;};
  const button=(text,fn,parent=root)=>{const node=el('button',text,parent);node.type='button';node.addEventListener('click',()=>Promise.resolve().then(fn).catch(error=>status.textContent=error.message));return node;};
  const details=(label)=>{const node=el('details');el('summary',label,node);return node;};
  el('h3','Population intelligence');el('p','Exploratory synthetic behavior • analyst assumptions • no empirical calibration');
  const status=el('p','Waiting for authoritative snapshot.');status.setAttribute('role','status');
  const overview=el('pre');button('Retain aggregate baseline',()=>{baseline=structuredClone(snapshot);render();});
  const cohorts=details('Income cohorts and aggregate comparison'), cohortOutput=el('pre','',cohorts);
  const why=details('WHY • selected resident and retained decisions');const selection=el('input',undefined,why);selection.placeholder='Synthetic person ID';selection.setAttribute('aria-label','Synthetic person ID');
  button('Inspect resident',async()=>{await setSelectedPerson(selection.value);onSelectPerson?.(selection.value);},why);const whyOutput=el('pre','Select a synthetic resident.',why);
  button('Export retained facts',()=>download('population-facts.json',populationFactTables(snapshot,selected?[selected]:[])),why);
  const trust=details('Targets, coefficient sources and model card'),trustOutput=el('pre','',trust);
  const workspace=details('Aggregate JSON / CSV data workspace');el('p','Paste a canonical JSON envelope, or CSV plus explicit metadata and column/district mappings. Source dates and units are required. Validation and proposals do not alter the live model.',workspace);
  const format=el('select',undefined,workspace);for(const value of ['json','csv']){const option=el('option',value.toUpperCase(),format);option.value=value;}
  const kind=el('select',undefined,workspace);for(const value of IMPORT_KINDS){const option=el('option',value,kind);option.value=value;}
  const data=el('textarea',undefined,workspace);data.placeholder='Aggregate data';data.setAttribute('aria-label','Aggregate JSON or CSV');data.rows=8;
  const metadata=el('textarea',undefined,workspace);metadata.setAttribute('aria-label','CSV source, units, columns and district mapping metadata');metadata.rows=5;metadata.value=JSON.stringify({datasetId:'user-dataset',source:{name:'',date:'',status:'observed'},units:{},columns:{},districtMapping:{}},null,2);
  const importOutput=el('pre','No dataset validated.',workspace);
  button('Validate and preview',()=>{const options=JSON.parse(metadata.value);imported=parsePopulationImport(data.value,{...options,filename:`data.${format.value}`,kind:kind.value,districtIds:(snapshot?.districts||[]).map(row=>row.id)});scorecard=imported.valid?scoreObservedPopulation(snapshot,imported.dataset):null;importOutput.textContent=JSON.stringify({...imported,dataset:imported.dataset?{...imported.dataset,rows:imported.dataset.rows.slice(0,6),totalRows:imported.dataset.rows.length}:null,scorecard},null,2);},workspace);
  button('Propose import for Studio review',async()=>{if(!onProposeImport)throw new Error('Studio import review callback is unavailable.');await onProposeImport(proposePopulationImport(imported,snapshot));status.textContent='Import proposal sent for review; live runtime unchanged.';},workspace);
  const parameter=el('input',undefined,workspace);parameter.placeholder='Parameter ID, e.g. transitService';parameter.setAttribute('aria-label','Calibration candidate parameter');
  const value=el('input',undefined,workspace);value.type='number';value.step='any';value.setAttribute('aria-label','Calibration candidate value');
  button('Propose candidate for review',async()=>{if(!onProposeCalibration)throw new Error('Studio calibration review callback is unavailable.');if(value.value==='')throw new Error('Enter a candidate value.');scorecard=scoreObservedPopulation(snapshot,imported?.dataset);await onProposeCalibration(proposeBehaviorCalibration({snapshot,scorecard,parameterId:parameter.value,candidateValue:Number(value.value)}));status.textContent='Candidate sent for review; no fitted result or live change is claimed.';},workspace);
  const sensitivity=details('Bounded numerical sensitivity');el('p','Baseline plus rent and transit levers; two paired seeds, one day, at most 1,000 diagnostic agents. Uses independent future runs.',sensitivity);const sensitivityOutput=el('pre','No diagnostic run yet.',sensitivity);
  button('Run diagnostic sensitivity',async()=>{if(job)throw new Error('A diagnostic run is already active.');const runRevision=revision;job=runPopulationSensitivity(runtime,snapshot,{onProgress:progress=>{if(!destroyed&&runRevision===revision)sensitivityOutput.textContent=JSON.stringify(progress,null,2);}});try{const result=await job.ready;if(!destroyed&&runRevision===revision){sensitivityOutput.textContent=JSON.stringify(result,null,2);lastExperiment=result;}}finally{job=null;}},sensitivity);
  button('Cancel diagnostic',()=>job?.cancel(),sensitivity);let lastExperiment=null;
  button('Export actual experiment',()=>{if(!lastExperiment)throw new Error('Run an experiment first.');download('population-sensitivity.json',lastExperiment);},sensitivity);
  button('Compare selected resident in paired futures',async()=>{if(!runtime.inspectFutureEntity)throw new Error('Nonmutating future entity inspection is unavailable; aggregate summaries cannot establish individual changes.');if(!lastExperiment || !selectedId)throw new Error('Run diagnostics and select a resident first.');const rows=lastExperiment.rows.filter(row=>row.status==='completed');const left=rows.find(row=>row.manifest?.configIndex===0),right=rows.find(row=>row.manifest?.configIndex===1&&row.manifest?.seed===left?.manifest?.seed);if(!left||!right)throw new Error('No completed paired futures available.');const a=await runtime.inspectFutureEntity(left,lastExperiment.manifest,{kind:'person',id:selectedId});const b=await runtime.inspectFutureEntity(right,lastExperiment.manifest,{kind:'person',id:selectedId});const before=a?.entity??a?.person??a,after=b?.entity??b?.person??b;if(!before?.id||!after?.id)throw new Error('Selected person is unavailable in the diagnostic sample.');whyOutput.textContent=JSON.stringify(compareBehaviorActors({baseline:[before],treatment:[after],baselineScenarioId:'diagnostic-baseline',treatmentScenarioId:'diagnostic-treatment',baselineManifest:{config:{...lastExperiment.manifest.configs[0],seed:left.manifest.seed},modelVersion:lastExperiment.manifest.modelVersion},treatmentManifest:{config:{...lastExperiment.manifest.configs[1],seed:right.manifest.seed},modelVersion:lastExperiment.manifest.modelVersion}}),null,2);},sensitivity);
  function download(name,value){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const anchor=doc.createElement('a');anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function render(){
    if(destroyed||!snapshot)return;lastRender=Date.now();
    const result=summarizePopulationIntelligence(snapshot,baseline,{includeTrust:false});
    status.textContent=`Tick ${snapshot.tick??0} • ${snapshot.metrics?.syntheticPopulation??snapshot.population??'?'} synthetic people • ${snapshot.visibleAgents?.length??0} visible sample`;
    overview.textContent=JSON.stringify({metrics:result.metrics,changes:result.metricChanges},null,2);
    if(cohorts.open)cohortOutput.textContent=JSON.stringify({cohorts:result.cohorts,note:result.comparisonNote},null,2);
    if(trust.open){
      const key=JSON.stringify([snapshot.config,snapshot.modelVersion,snapshot.provenance,snapshot.coefficientModels]);
      if(key!==cardKey){cachedCard=buildBehaviorModelCard(snapshot);cardKey=key;}
      trustOutput.textContent=JSON.stringify({targets:validatePopulationTargets(snapshot),warnings:behaviorRangeWarnings(snapshot.config),modelCard:cachedCard},null,2);
    }
  }
  function scheduleRender(){if(destroyed||renderTimer!==null)return;const delay=Math.max(0,500-(Date.now()-lastRender));renderTimer=setTimeout(()=>{renderTimer=null;render();},delay);}
  for(const section of [cohorts,trust])section.addEventListener('toggle',()=>{if(section.open)render();});
  async function setSelectedPerson(personOrId){const id=typeof personOrId==='object'?personOrId?.id??personOrId?.personId:personOrId;if(!id)return;selectedId=id;selection.value=id;const serial=++request;const person=await runtime.inspectPerson(id);if(destroyed||serial!==request)return;selected=person;const household=person?.householdId&&runtime.inspectHousehold?await runtime.inspectHousehold(person.householdId):null;if(destroyed||serial!==request)return;whyOutput.textContent=JSON.stringify({person:explainPopulationEntity(person),household:household?explainPopulationEntity(household):null},null,2);}
  function update(next){const incoming=next||runtime.getSnapshot?.();if(incoming?.runtime?.revision!==undefined&&incoming.runtime.revision!==revision){request++;job?.cancel();selected=null;selectedId=null;baseline=null;lastExperiment=null;sensitivityOutput.textContent='Model reset: previous diagnostics cleared.';selection.value='';whyOutput.textContent='Model reset: select a resident from the current run.';revision=incoming.runtime.revision;}snapshot=incoming;scheduleRender();}
  const unsubscribe=runtime.subscribe?.(update);const selectionEvent=event=>{if(event.detail?.personId)setSelectedPerson(event.detail.personId).catch(error=>{if(!destroyed)status.textContent=error.message;});};doc.defaultView?.addEventListener('world:population-selection',selectionEvent);render();
  return {update,setSelectedPerson,destroy(){destroyed=true;clearTimeout(renderTimer);request++;job?.cancel();unsubscribe?.();doc.defaultView?.removeEventListener('world:population-selection',selectionEvent);root.remove();stylesheet.remove();}};
}
