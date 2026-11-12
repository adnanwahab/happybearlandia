import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Exercise the actual coordinator functions with controlled network completion.
// DOM/rendering collaborators are spies; responses contain lifecycle metadata only.
const source = readFileSync(new URL('../world/decision/studio.js', import.meta.url), 'utf8');
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const functions = [section('function markDirty()', 'function showCompileReport'), section('async function runExperiment(', 'let activeRequest ='), section('async function reopenExperiment(', 'function loadInput(')].join('\n');
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; };
const result = id => ({experiment:{id,status:'completed'},runs:[]});
function harness() {
  const nodes = new Map(), renders = [], urls = [], messages = [], watches = [];
  const state = {generation:0,readonly:false,busy:false,hasRun:false,results:null};
  let input = {seed:42,policies:['old']};
  const client = {create:async()=>result('old'),start:async id=>result(id),results:async id=>result(id),watch(id,callbacks){const watch={id,...callbacks,destroyed:false,destroy(){this.destroyed=true;}};watches.push(watch);return watch;}};
  const context = {state,client,activeRequest:0,traceSelectionToken:0,automaticTraceKey:null,constructionRun:null,previewTimer:null,
    $:id=>{if(!nodes.has(id))nodes.set(id,{value:10,checked:false});return nodes.get(id);},
    clearTimeout, setTimeout, clone:structuredClone, validateInput:x=>x,currentInput:()=>structuredClone(input),
    runTraces:{clear(){},setExperiment(){}},updateAdvancedStudio(){},updateDraftTrust(){},
    setBusy:value=>{state.busy=value;},status:message=>messages.push(message),
    renderResults:value=>{renders.push(value.experiment.id);state.results=value;},updateExperimentUrl:id=>urls.push(id),
    successfulRuns:()=>[],refreshExperiments:async()=>{},loadInput:value=>{input=value;},setReadonly:value=>{state.readonly=value;},
  };
  runInNewContext(functions+'\nthis.api={runExperiment,reopenExperiment,markDirty};',context);
  return {...context.api,state,client,watches,renders,urls,messages,edit(){input={seed:99,policies:['new']};context.api.markDirty();},get input(){return input;}};
}
for (const phase of ['create','start','poll']) test(`input edit discards delayed ${phase} response after a newer run`,async()=>{
  const h=harness(), gate=deferred(), entered=deferred();
  const original=h.client[phase];
  if(phase!=='poll')h.client[phase]=(...args)=>{entered.resolve();return gate.promise;};
  const old=h.runExperiment();
  if(phase==='poll')await old;else await entered.promise;
  const oldWatch=h.watches[0];
  h.edit();expect(h.state.busy).toBe(false);expect(h.state.dirty).toBe(true);
  h.client.create=async input=>{expect(input.seed).toBe(99);expect(input.policies).toEqual(['new']);return result('new');};
  if(phase!=='poll')h.client[phase]=phase==='create'?h.client.create:original;
  await h.runExperiment();h.watches.at(-1).onUpdate(result('new'));
  if(phase==='poll'){expect(oldWatch.destroyed).toBe(true);oldWatch.onUpdate(result('old'));oldWatch.onError(new Error('old failure'));}
  else {gate.resolve(result('old'));await old;}
  expect(h.renders).toEqual(['new']);expect(h.urls).toEqual(phase==='poll'?['old','new']:['new']);expect(h.state.experiment.id).toBe('new');expect(h.state.busy).toBe(false);
});

test('edited input supersedes saved experiment loading and its errors',async()=>{
  for(const fail of [false,true]){
    const h=harness(),gate=deferred();h.client.results=()=>gate.promise;
    const old=h.reopenExperiment('old');h.edit();h.client.create=async()=>result('new');await h.runExperiment();h.watches.at(-1).onUpdate(result('new'));
    const before=[...h.messages];
    if(fail)gate.reject(new Error('obsolete load failed'));else gate.resolve(result('obsolete'));
    await old;expect(h.input.seed).toBe(99);expect(h.renders).toEqual(['new']);expect(h.messages).toEqual(before);
  }
});

test('superseded run failures cannot clear a newer busy request',async()=>{
  const h=harness(),gate=deferred();h.client.create=()=>gate.promise;
  const old=h.runExperiment();h.edit();h.client.create=async()=>result('new');await h.runExperiment();
  gate.reject(new Error('obsolete creation failed'));await old;
  expect(h.state.busy).toBe(true);expect(h.messages).not.toContain('obsolete creation failed');
});

test('old reopened watcher errors and progress cannot mutate a fresh running draft',async()=>{
  const h=harness();h.client.results=async()=>({experiment:{id:'saved',status:'running'},runs:[]});
  await h.reopenExperiment('saved');const old=h.watches[0];
  h.edit();h.client.create=async()=>result('new');await h.runExperiment();
  const before=[...h.messages];old.onError(new Error('obsolete poll failed'));old.onUpdate(result('saved'));
  expect(old.destroyed).toBe(true);expect(h.state.busy).toBe(true);expect(h.state.experiment.id).toBe('new');expect(h.messages).toEqual(before);expect(h.renders).toEqual(['saved']);
});
