import { describe, test, expect } from 'bun:test';
import { EXPERIENCES, searchExperiences, entityActions } from '../world/universe/registry.js';
import { DEFAULT_CONTEXT, contextFromURL, contextURL, shellURL, createFrameBridge, navigationMessage } from '../world/universe/navigation.js';
const context={...DEFAULT_CONTEXT,experimentId:'experiment:test:one',runId:'run:test:one',branchId:'branch:test:fork',tick:42,entityId:'person:test:ada'};
describe('universe navigation',()=>{
 test('catalog preserves original experiences and registers the verified map and flagship',()=>{
  expect(EXPERIENCES).toHaveLength(32);expect(new Set(EXPERIENCES.map(x=>x.id)).size).toBe(EXPERIENCES.length);expect(EXPERIENCES.find(x=>x.id==='future-machine').route).toBe('/world/future-machine.html');expect(EXPERIENCES.find(x=>x.id==='houston-map').route).toBe('/tools/houston-map');expect(EXPERIENCES.find(x=>x.id==='houston-bars').route).toBe('/world/bars/');
  expect(EXPERIENCES.some(x=>['/tools','/blog','/twitch-plays-robot'].includes(x.route))).toBe(false);
  expect(searchExperiences('/world/house')[0].id).toBe('house');expect(searchExperiences('climate')[0].id).toBe('climate');
 });
 test('round trip retains scope and app-specific parameters/hash',()=>{
  const url=contextURL('/world/decision.html?demo=1#advanced',context);
  expect(contextFromURL(url)).toEqual(context);expect(url).toContain('demo=1');expect(url.endsWith('#advanced')).toBe(true);
  expect(contextFromURL(shellURL('worldline',context))).toEqual(context);
  expect(entityActions(context).map(x=>x.id)).toContain('house');
 });
 test('rejects ambiguous, malformed and cross-origin links',()=>{
  expect(()=>contextFromURL('/?tick=-1')).toThrow();expect(()=>contextFromURL('/?entityId=local')).toThrow();
  expect(()=>contextFromURL('/?runId=run:test:one&runId=run:test:two')).toThrow();
  expect(()=>contextURL('https://elsewhere.test/',context)).toThrow();expect(()=>shellURL('tools',context)).toThrow();
  expect(contextFromURL('/')).toEqual(DEFAULT_CONTEXT);
 });
 test('iframe requires exact source, origin, version, context and registered route; disposes',()=>{
  const handlers=new Map(), listeners=new Map(), sent=[];const child={postMessage:(...args)=>sent.push(args)};
  const host={location:{origin:'http://localhost'},addEventListener:(t,f)=>handlers.set(t,f),removeEventListener:t=>handlers.delete(t)};
  const frame={contentWindow:child,addEventListener:(t,f)=>listeners.set(t,f),removeEventListener:t=>listeners.delete(t)};
  let current=context,navigated=[];
  const dispose=createFrameBridge({host,frame,context:()=>current,onContext:v=>{current=v;},onNavigate:v=>navigated.push(v)});
  const event=(data,extra={})=>handlers.get('message')({origin:'http://localhost',source:child,data,...extra});
  const select=navigationMessage('select',context,{entityId:'person:test:bob'});
  event(select,{origin:'https://evil.test'});event(select,{source:{}});event({...select,version:2});
  event({...select,context:{...context,worldId:'world:test:foreign'}});
  event({...select,context:{...context,runId:'run:test:stale'}});expect(current).toEqual(context);
  event(select);expect(current.entityId).toBe('person:test:bob');
  event(navigationMessage('context',{...current,scenarioId:'scenario:test:alternative'}));expect(current.scenarioId).toBe('scenario:test:alternative');
  event(navigationMessage('navigate',current,{experienceId:'javascript:alert(1)'}));expect(navigated).toEqual([]);
  event(navigationMessage('navigate',current,{experienceId:'worldline'}));expect(navigated).toEqual(['worldline']);
  listeners.get('load')();expect(sent[0][1]).toBe('http://localhost');expect(sent[0][0].type).toBe('context');
  dispose();expect(handlers.size).toBe(0);expect(listeners.size).toBe(0);
 });
});
