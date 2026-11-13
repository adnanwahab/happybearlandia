import {test,expect} from 'bun:test';
import {DEFAULT_RECIPE} from '../world/future-machine/contracts.js';
import {followUpRecipe} from '../world/future-machine/follow-up.js';

test('follow-up preserves seed and all inputs except supported housing amount and budget',()=>{
 const input=structuredClone({...DEFAULT_RECIPE,seed:739}),before=structuredClone(input);
 const next=followUpRecipe(input);
 expect(input).toEqual(before);
 expect(next).toEqual({...input,intervention:{...input.intervention,amount:36,cost:1500000}});
});
test('no offer for absent or out-of-bounds housing policy',()=>{
 expect(followUpRecipe({...DEFAULT_RECIPE,intervention:null})).toBeNull();
 expect(followUpRecipe({...DEFAULT_RECIPE,intervention:{...DEFAULT_RECIPE.intervention,amount:109}})).toBeNull();
 expect(followUpRecipe({...DEFAULT_RECIPE,intervention:{...DEFAULT_RECIPE.intervention,amount:108}}).intervention.amount).toBe(120);
});
