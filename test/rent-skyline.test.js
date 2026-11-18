import {test, expect} from 'bun:test';
import {rentSkyline, RENT_EDGES} from '../world/decision/rent-skyline.js';
import fixture from './fixtures/rent-skyline/representative.json';
import {simulateHousingRun, createHousingScenarios} from '../world/models/housing/index.js';
test('boundary fixture reconciles denominator and exact supported identities', () => {
 const result=rentSkyline(fixture.rows);
 expect(result.bins.map(b=>b.members.length)).toEqual(fixture.counts);
 expect(result.missing).toBe(fixture.missing); expect(result.denominator).toBe(fixture.denominator);
 expect(result.supported+result.missing).toBe(result.denominator);
 expect(result.bins.flatMap(b=>b.members.map(r=>r.id))).toEqual(['zero','edge','upper']);
});
test('invalid values stay missing; empty remains empty and duplicates rejected',()=>{
 const result=rentSkyline([null,undefined,NaN,Infinity,-1,'500'].map((value,i)=>({id:String(i),metrics:{median_rent:value}})));
 expect(result.supported).toBe(0);expect(result.missing).toBe(6);
 expect(rentSkyline().denominator).toBe(0);
 expect(()=>rentSkyline([{id:'a'},{id:'a'}])).toThrow('Duplicate');
});
test('actual seed-matched housing runs replay and retain fixed comparison bins',()=>{
 const make=()=>createHousingScenarios().slice(0,2).map(s=>Array.from({length:5},(_,i)=>({id:`${s.id}_${i}`,seed:42+i,...simulateHousingRun({parameters:s.parameters,seed:42+i,years:2})})));
 const cohorts=make();expect(make()).toEqual(cohorts);
 const charts=cohorts.map(rentSkyline);
 for(const chart of charts){expect(chart.bins.map(b=>b.min)).toEqual(RENT_EDGES.slice(0,-1));expect(chart.supported).toBe(5);expect(chart.bins.reduce((n,b)=>n+b.members.length,0)).toBe(chart.denominator);}
});
