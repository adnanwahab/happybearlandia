import {test,expect} from 'bun:test';
import {createShareCard,shareCardSVG} from '../world/future-machine/share/card.js';
import {DEFAULT_RECIPE} from '../world/future-machine/contracts.js';
import {initialForRecipe,normalizeReplay} from '../world/future-machine/data/index.js';
import {createEngine,addIntervention} from '../world/city/engine.js';
function history(intervention=DEFAULT_RECIPE.intervention){
 const recipe={...DEFAULT_RECIPE,households:2,intervention},initial=initialForRecipe(recipe);
 const replay=state=>{const steps=[];for(let i=0;i<120;i++){const step=createEngine().step(state);steps.push(step);state=step.state;}return {steps};};
 return {recipe,seed:recipe.seed,modelVersion:recipe.modelVersion,experimentId:'city_card',initialHash:'fixture-digest',baseline:normalizeReplay(initial,replay(initial)),plan:normalizeReplay(initial,replay(intervention?addIntervention(initial,intervention):initial))};
}
test('card uses exact recorded values and units without mutating the paired run',()=>{
 const h=history(),before=JSON.stringify(h);
 for(const month of [0,16,120]){const card=createShareCard(h,month);for(const row of card.rows){expect(row.baseline).toBe(h.baseline[month].metrics[row.key]);expect(row.plan).toBe(h.plan[month].metrics[row.key]);expect(row.delta).toBe(row.plan-row.baseline);}expect(card.seed).toBe(h.seed);expect(shareCardSVG(card)).toContain('Synthetic data');}
 expect(JSON.stringify(h)).toBe(before);
});
test('no intervention, absent observations, mismatched records and escaped metadata',()=>{
 const h=history(null);expect(createShareCard(h,120).comparison).toContain('No change');
 h.plan[120].metrics.meanRent=null;expect(createShareCard(h,120).rows[1].plan).toBeNull();expect(shareCardSVG(createShareCard(h,120))).toContain('Unavailable');
 h.plan[120].state.seed=9;expect(()=>createShareCard(h,120)).toThrow('matched');h.plan[120].state.seed=h.seed;
 h.plan[120].month=119;expect(()=>createShareCard(h,120)).toThrow();
 const card=createShareCard(history(null),0);card.initialHash='<script>&';expect(shareCardSVG(card)).toContain('&lt;script&gt;&amp;');
});
