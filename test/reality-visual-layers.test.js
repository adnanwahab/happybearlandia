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
