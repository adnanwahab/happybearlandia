import {test,expect} from 'bun:test';
import {REALITY_VISUAL_LAYERS,visualLayerAvailability,filterVisualHotspots} from '../world/reality/visual-layers.js';
import {computeRealityHotspots} from '../world/reality/hotspots.js';
test('50 requested views expose missing subsystems without treating example outcomes as measurements',()=>{
 expect(REALITY_VISUAL_LAYERS).toHaveLength(50);const state={units:[{id:'u',rent:900}],visibleAgents:[{id:'p',satisfaction:.6}]};
 expect(visualLayerAvailability(REALITY_VISUAL_LAYERS[6],state,state)).toMatchObject({available:true,fields:['units.rent']});
 for(const id of [13,14,15,19,20,22,23,24,25,26,27,28])expect(visualLayerAvailability(REALITY_VISUAL_LAYERS[id-1],state,state).available).toBe(false);
 expect(REALITY_VISUAL_LAYERS[36].note).toContain('not measured happiness');
});
test('metric filtering recalculates magnitude and direction from retained selected fields',()=>{
 const report=computeRealityHotspots({baseline:{units:[{id:'u',buildingId:'b',rent:100,quality:.5}]},current:{units:[{id:'u',buildingId:'b',rent:150,quality:.7}]},worldContext:{buildings:[{id:'b',center:[1,2]}]}}),original=structuredClone(report),filtered=filterVisualHotspots(report,['units.rent']);
 expect(filtered.hotspots[0]).toMatchObject({strength:.5,direction:'negative'});expect(filtered.hotspots[0].changes).toHaveLength(1);expect(report).toEqual(original);expect(filterVisualHotspots(report,[]).hotspots).toHaveLength(0);
});
test('aggregate records stay explicit and absent permit pairs never become invented latency',()=>{
 const state={activityMinutes:{HOME:120,WORK:30},activityCounts:{HOME:4},finance:{balance:200,capitalExpense:0},projects:[{id:'p',stage:'permit',duration:12}]};
 const time=visualLayerAvailability(REALITY_VISUAL_LAYERS[37],state,state);expect(time.available).toBe(true);expect(time.records[0]).toMatchObject({field:'activityMinutes',baseline:{HOME:120,WORK:30}});
 expect(visualLayerAvailability(REALITY_VISUAL_LAYERS[44],state,state).available).toBe(false);
 const budget=visualLayerAvailability(REALITY_VISUAL_LAYERS[41],state,state);expect(budget.records.map(row=>row.field)).toEqual(['finance.balance']);
});
