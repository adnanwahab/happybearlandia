import {test, expect} from 'bun:test';
import {houseNeedExplanation} from '../world/house/need-explanation.js';
test('inspection preserves identities and clock without turning rates into historical deltas',()=>{
 const person={id:'saved-p7',needs:{hunger:40},needRates:{hunger:2},needActivity:'Eat',needsSource:'Synthetic activity model'}, before=structuredClone(person);
 expect(houseNeedExplanation(person,'hunger',365)).toMatchObject({personId:'saved-p7',minute:365,value:40,rate:2,activity:'Eat'});
 expect(houseNeedExplanation(person,'hunger',365).history).toContain('Unknown');
 expect(houseNeedExplanation(person,'hunger',365)).toEqual(houseNeedExplanation(person,'hunger',365));
 expect(person).toEqual(before);
});
test('missing and nonfinite data stays unknown; zero remains observed',()=>{
 expect(houseNeedExplanation({},'hunger',NaN)).toMatchObject({value:null,rate:null,minute:null});
 expect(houseNeedExplanation({needs:{fun:0},needRates:{fun:Infinity}},'fun',0)).toMatchObject({value:0,rate:null,minute:0});
});
