import {test, expect} from 'bun:test';
import {chooseWonder, WONDERS} from '../world/universe/surprise.js';
test('ten selections use supported routes and repeat exactly', () => {
  expect(chooseWonder(42).id).toBe('invention');
  const seen = new Set();
  for (let seed=0; seed<10; seed++) {
    const choice = chooseWonder(seed);
    expect(WONDERS).toContain(choice);
    expect(chooseWonder(seed)).toBe(choice);
    seen.add(choice.id);
  }
  expect(seen.size).toBe(3);
});
test('invalid and unavailable selections fail closed; external routes cannot enter curation', () => {
  for (const seed of [-1, 0.5, NaN, Infinity, 4294967296, '42']) expect(chooseWonder(seed)).toBeNull();
  expect(chooseWonder(42, [])).toBeNull();
  expect(chooseWonder(42, [{id:'unknown', route:'https://example.com'}])).toBeNull();
  expect(chooseWonder(42, [{id:WONDERS[0].id, route:'https://example.com'}])).toBe(WONDERS[0]);
  expect(chooseWonder(4294967295)).not.toBeNull();
});

test('component reveals a labeled choice, invalidates stale links, and fails closed when empty', async () => {
  const {mountSurprise}=await import('../world/universe/surprise.js');
  // Minimal event fixture tests the component state; native keyboard/touch is covered by Playwright.
  const element = () => ({hidden:false, textContent:'', listeners:{}, addEventListener(type,fn){this.listeners[type]=fn;},removeEventListener(type){delete this.listeners[type];}, removeAttribute(key){delete this[key];}});
  function fixture() {
    const form=element(),input={...element(),value:'42'},status=element(),link=element(),button=element();
    const nodes={'form':form,'input':input,'[role="status"]':status,'[data-change-world]':link,'button':button};
    const root={hidden:true,querySelector:key=>nodes[key]};
    return {root,form,input,status,link,button,submit:()=>form.listeners.submit({preventDefault(){}})};
  }
  const f=fixture(),dispose=mountSurprise(f.root);
  expect(f.link.hidden).toBe(true);
  f.submit();
  expect(f.link.href).toBe(chooseWonder(42).route);
  expect(f.status.textContent).toContain('model seed');
  expect(f.status.textContent).toContain('Selection seed 42');
  f.input.value='43';f.input.listeners.input();
  expect(f.link.hidden).toBe(true);expect(f.link.href).toBeUndefined();
  f.input.value='';f.submit();expect(f.link.hidden).toBe(true);
  dispose();expect(Object.keys(f.form.listeners)).toEqual([]);
  const empty=fixture();empty.link.href='/stale';mountSurprise(empty.root,{available:[]});
  expect(empty.button.disabled).toBe(true);expect(empty.status.textContent).toContain('unavailable');
  expect(empty.link.href).toBeUndefined();
});
