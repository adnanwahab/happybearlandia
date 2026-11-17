import {test,expect} from 'bun:test';
import {representativeCelebration} from './fixtures/celebration/verified-challenge.js';
import {celebrationOccurrence,createCelebrationGate} from '../world/challenges/celebration.js';
test('real deterministic replay produces one occurrence; repeats and malformed evidence cannot celebrate',async()=>{
 const a=await representativeCelebration(),b=await representativeCelebration();expect(a).toEqual(b);
 const before=JSON.stringify(a),gate=createCelebrationGate();expect(gate(a.envelope,a.result)).toBe(true);expect(gate(b.envelope,b.result)).toBe(false);
 for(const mutate of [r=>r.won=false,r=>r.status='metrics-unavailable',r=>r.challengeId='other',r=>r.candidate.seed++,r=>r.candidate.initialHash='other',r=>r.metrics[0].delta=null,r=>r.metrics[0].noWorse=false,r=>r.guards=[],r=>r.budget.candidateWithinCap=false]){
  const result=structuredClone(a.result);mutate(result);expect(celebrationOccurrence(a.envelope,result)).toBe(null);
 }
 expect(celebrationOccurrence(null,a.result)).toBe(null);expect(celebrationOccurrence(a.envelope,null)).toBe(null);expect(JSON.stringify(a)).toBe(before);
});

test('visual lifetime cancels all resources, honors reduced motion, skips and cannot restart after destruction',async()=>{
 const {mountChallengeCelebration}=await import('../world/challenges/celebration.js');
 for(const reduced of [false,true]){
  let timers=new Map(),next=0,cancelled=0,started=0,removed=0;const listeners=new Set();
  const motion={matches:reduced,addEventListener:(type,fn)=>listeners.add(fn),removeEventListener:(type,fn)=>listeners.delete(fn)};
  const win={matchMedia:()=>motion,setTimeout:fn=>{timers.set(++next,fn);return next;},clearTimeout:id=>timers.delete(id)};
  const doc={defaultView:win,createElement:()=>({children:[],setAttribute(){},append(...nodes){this.children.push(...nodes);},remove(){removed++;},animate(){started++;return{cancel(){cancelled++;}};}})};
  const container={ownerDocument:doc,append(root){this.root=root;}},view=mountChallengeCelebration(container);
  view.show();expect(container.root.hidden).toBe(false);expect(started).toBe(reduced?0:7);expect(timers.size).toBe(1);
  for(const fn of listeners)fn();expect(cancelled).toBe(started);
  container.root.children[1].onclick();expect(container.root.hidden).toBe(true);expect(timers.size).toBe(0);
  view.show();view.destroy();view.destroy();expect(cancelled).toBe(started);expect(timers.size).toBe(0);expect(listeners.size).toBe(0);expect(removed).toBe(1);
  view.show();expect(timers.size).toBe(0);
 }
});
