import {test,expect} from 'bun:test';
import {simulateOne,summarize} from '../tools/riskuniverse/model.js';
const base={n:1000,seed:42,years:1,rho:.25,capital:1e7,confidence:.95,assets:[[.6,.07,.2],[.3,.03,.06],[.1,.05,.14]]};
function dataFor(p){let data=new Float32Array(p.n*20);for(let i=0;i<p.n;i++){let r=simulateOne(p,i);data.set(r.values,i*20);data.set(r.path,i*20+3);data.set(r.sums,i*20+16);}return data;}
test('zero-volatility model matches closed-form compounded drift',()=>{let p={...base,assets:[[.6,.07,0],[.3,.03,0],[.1,.05,0]]};let r=simulateOne(p,0),expected=.6*Math.exp(.07)+.3*Math.exp(.03)+.1*Math.exp(.05);expect(r.path.at(-1)).toBeCloseTo(expected,12);expect(simulateOne(p,999).path).toEqual(r.path);});
test('seed streams repeat and scenarios differ',()=>{expect(simulateOne(base,17)).toEqual(simulateOne(base,17));expect(simulateOne(base,18).values).not.toEqual(simulateOne(base,17).values);expect(simulateOne({...base,seed:43},17).values).not.toEqual(simulateOne(base,17).values);});
test('empirical tail attribution reconciles and uses correct tail count',()=>{let r=summarize(dataFor(base),base);expect(r.k).toBe(50);expect(r.es).toBeGreaterThanOrEqual(r.var);expect(r.attribution.reduce((s,v)=>s+v,0)).toBeCloseTo(r.es,6);expect(r.referenceError).toBeLessThan(1e-6);expect(r.sensitivity.every(Number.isFinite)).toBe(true);});
test('99 percent confidence uses ten worst scenarios out of 1000',()=>{let p={...base,confidence:.99},r=summarize(dataFor(p),p);expect(r.k).toBe(10);expect(r.var).toBeCloseTo(1-r.rows[9].value,12);});
