import {test, expect} from 'bun:test';
import {DEFAULT_RECIPE} from '../world/future-machine/contracts.js';
import {RECENT_KEY, readRecent, saveRecent, clearRecent} from '../world/future-machine/recent.js';
const context={recipe:DEFAULT_RECIPE,experimentId:'city_recent',month:73};
function storage(){const data=new Map();return {data,getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};}

test('reading does not write; explicit save retains only exact replay context; clear revokes state',()=>{
  const store=storage();expect(readRecent(store)).toBeNull();expect(store.data.size).toBe(0);
  saveRecent(store,context);expect(readRecent(store)).toEqual(context);expect([...store.data.keys()]).toEqual([RECENT_KEY]);
  expect(JSON.parse(store.data.get(RECENT_KEY))).toEqual(context);
  clearRecent(store);expect(readRecent(store)).toBeNull();
});
test('rejects private fields, corrupt, oversized, incompatible and out-of-range references',()=>{
  const store=storage();
  for(const value of [{...context,email:'private@example.test'},{...context,month:121},{...context,experimentId:'https://private.test'}, {...context,recipe:{...DEFAULT_RECIPE,modelVersion:'expired'}},{...context,recipe:{...DEFAULT_RECIPE,name:'private'}},null,[]]){
    store.setItem(RECENT_KEY,JSON.stringify(value));expect(()=>readRecent(store)).toThrow();
  }
  for(const raw of ['bad json','x'.repeat(4097)]){store.setItem(RECENT_KEY,raw);expect(()=>readRecent(store)).toThrow();}
  expect(()=>saveRecent(store,{...context,privateDetails:'secret'})).toThrow();
});
test('denied reads, writes and reset propagate for visible UI feedback',()=>{
  const denied={getItem(){throw Error('denied');},setItem(){throw Error('quota');},removeItem(){throw Error('denied');}};
  expect(()=>readRecent(denied)).toThrow('denied');expect(()=>saveRecent(denied,context)).toThrow('quota');expect(()=>clearRecent(denied)).toThrow('denied');
});
