import {test,expect} from 'bun:test';
import {tourStops,TOUR_VERSION} from '../world/universe/magic-tour.js';
import {parseShareURL} from '../world/future-machine/share/index.js';
import {DEFAULT_RECIPE} from '../world/future-machine/contracts.js';

test('City stops pin the exact supported recipe, never invent a saved run',()=>{
 const stops=tourStops();expect(TOUR_VERSION).toBe('magic-tour.1');
 expect(new Set(stops.map(s=>s.id)).size).toBe(6);
 for(const stop of stops.slice(2)){
  const context=parseShareURL(new URL(stop.href,'http://localhost').href);
  expect(context.recipe).toEqual(DEFAULT_RECIPE);expect(context.experimentId).toBeNull();
 }
 expect(stops.slice(2).map(s=>parseShareURL(new URL(s.href,'http://localhost').href).month)).toEqual([0,16,16,120]);
});
test('Population handoff and missing evidence remain explicit',()=>{
 const stops=tourStops();expect(stops[1].text).toContain('save access');
 expect(stops[1].text).toContain('unfinished');expect(stops[2].text).toContain('does not change the household');
 expect(stops[3].text).toContain('same recipe');expect(stops[4].text).toContain('Missing causal records remain missing');
 expect(stops[5].text).toContain('private by default');expect(stops[5].text).toContain('explicit rights');
});
