import {test,expect} from 'bun:test';
import {startBudget,budgetStep,cancelBudget,replayBudget} from '../world/house/budget-puzzle.js';
test('pinned seven-day success, immutable checkpoints and matched replay',()=>{
 const start=startBudget();let s=start;
 for(let day=1;day<=7;day++){if(s.food===0)s=budgetStep(s,'groceries');s=budgetStep(s,'endDay');}
 expect(s.status).toBe('success');expect(s.cash).toBe(36);expect(s.food).toBe(1);expect(s.checkpoints).toHaveLength(7);
 expect(replayBudget(s)).toEqual(s);expect(start).toEqual(startBudget());expect(Object.isFrozen(s.checkpoints[0])).toBe(true);
 expect(s.checkpoints[6].parentId).toBe('day-6');expect(()=>budgetStep(s,'groceries')).toThrow();
});
test('specific food and rent failures do not invent spending',()=>{
 let s=startBudget();s=budgetStep(budgetStep(budgetStep(s,'endDay'),'endDay'),'endDay');expect(s.status).toBe('failed');expect(s.cash).toBe(100);
 s=startBudget();for(let i=0;i<4;i++)s=budgetStep(s,'groceries');s=budgetStep(s,'treat');for(let i=0;i<7;i++)s=budgetStep(s,'endDay');
 expect(s.status).toBe('failed');expect(s.reason).toContain('Rent');expect(s.cash).toBe(37);expect(replayBudget(s)).toEqual(s);
});
test('invalid, unaffordable, cancelled, absent and mismatched evidence',()=>{
 let s=startBudget();for(let i=0;i<6;i++)s=budgetStep(s,'treat');const before=structuredClone(s);expect(()=>budgetStep(s,'groceries')).toThrow('Not enough');expect(s).toEqual(before);
 expect(()=>budgetStep(s,'toString')).toThrow('Unsupported');expect(()=>startBudget(null)).toThrow('No source');
 const cancelled=cancelBudget(s);expect(cancelled.status).toBe('cancelled');expect(replayBudget(cancelled)).toEqual(cancelled);expect(cancelled.checkpoints).toEqual(s.checkpoints);
 for(const patch of [{cash:999},{version:'future'},{scenario:{...s.scenario,seed:1}},{checkpoints:[{id:'invented'}]}])expect(()=>replayBudget({...s,...patch})).toThrow('Replay mismatch');
});

import {createUIDocument} from './helpers/ui-dom.js';
import {mountBudgetPuzzle} from '../world/house/budget-puzzle-ui.js';
test('real puzzle UI commits calendar, disables impossible purchases and exposes explicit empty state',()=>{
 const doc=createUIDocument(),root=doc.createElement('div');mountBudgetPuzzle(root);
 const button=label=>root.querySelectorAll('button').find(n=>n.textContent===label);
 const status=()=>root.querySelector('[role="status"]').textContent;
 for(let i=0;i<6;i++)button('Buy a treat · 15 credits').onclick();
 expect(button('Buy 3 food · 12 credits').disabled).toBe(true);expect(status()).toContain('10 credits');
 button('Restart matched scenario').onclick();
 for(let day=1;day<=7;day++){if(day===3||day===6)button('Buy 3 food · 12 credits').onclick();button('Finish day · consume 1 food').onclick();}
 expect(status()).toContain('success');expect(root.querySelectorAll('li')).toHaveLength(7);
 expect(root.querySelectorAll('li')[2].textContent).toContain('groceries, endDay');
 button('Verify recorded replay').onclick();expect(status()).toContain('success');
 button('Restart matched scenario').onclick();button('Cancel week').onclick();expect(status()).toContain('cancelled');
 expect(root.querySelector('a').href).toBe('/world/house');
 mountBudgetPuzzle(root,{source:null});expect(status()).toContain('No source scenario');expect(root.querySelectorAll('button')).toHaveLength(0);
});

test('normal House entry exposes puzzle link and routes without loading or mutating source households',async()=>{
 const {startHouseApp}=await import('../world/house/app.js');
 const doc=createUIDocument(),root=doc.createElement('div'),oldFetch=globalThis.fetch;
 const requests=[];globalThis.fetch=async url=>{requests.push(url);return Response.json({homes:[]});};
 try{
  await startHouseApp(root,{location:{pathname:'/world/house',search:''}});
  const link=root.querySelectorAll('a').find(n=>n.textContent==='Play One Salary, Seven Days');expect(link.href).toBe('/world/house?budgetPuzzle=1');
  requests.length=0;await startHouseApp(root,{location:{pathname:'/world/house',search:'?budgetPuzzle=1'}});
  expect(root.querySelector('h1').textContent).toBe('One Salary, Seven Days');expect(requests).toEqual([]);
 }finally{globalThis.fetch=oldFetch;}
});
