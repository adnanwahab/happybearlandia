// Offline authoring adapter only. The browser reads the pinned archive, never runs City.
import {createCity} from '../city/seed.js';
import {createEngine, scheduleShock} from '../city/engine.js';
import {VERSION} from '../city/contracts.js';
export function recordDemo() {
  let initial = createCity({seed:714, households:30});
  // Synthetic fixture assumptions: no private development; certain d1 flood exposure.
  initial.parcels.forEach(parcel => { parcel.capacity = 0; });
  initial.districts[1].floodRisk = 1;
  initial = scheduleShock(initial, {type:'flood', districtId:'d1', start:1, duration:2, severity:1});
  const engine = createEngine(undefined, {trace:true});
  const {steps} = engine.run(initial, 3);
  const selectors = [
    ['housing', 0, 'decisions', row => row.actorType === 'housing'],
    ['transit', 0, 'causalRecords', row => row.system === 'transport' && row.entity?.[1] === 'transit-d1-d0'],
    ['flood', 0, 'events', row => row.eventType === 'FLOOD_DAMAGE'],
    ['business', 2, 'state/businesses', row => row.id === 'business-d0'],
    ['households', 0, 'events', row => row.eventType === 'RESIDENT_MONTH'],
  ];
  const stops = selectors.map(([id, step, collection, predicate]) => {
    const index = collection.split('/').reduce((value,key)=>value[key],steps[step]).findIndex(predicate);
    if (index < 0) throw Error('Missing authored mechanism: '+id);
    return {id, pointer:`/steps/${step}/${collection}/${index}`, month:steps[step].state.month};
  });
  return {version:'neighborhood-hunt.v1', runId:'synthetic:neighborhood-hunt:714:v1', modelVersion:VERSION,
    seed:714, source:'Synthetic Monthly City toy model; no measured observations', initial, steps, stops};
}
