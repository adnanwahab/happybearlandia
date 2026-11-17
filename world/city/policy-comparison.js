import {createCity} from './seed.js';
import {VERSION} from './contracts.js';

export const POLICY_COMPARISON_VERSION = 'housing-drainage.v1';

// Fixed synthetic demonstration, separate from the editable/imported lab plan.
export function housingDrainageExperiment() {
  const initial = createCity({seed:42, households:120});
  initial.provenance.guidedComparison = {
    recipeVersion:POLICY_COMPARISON_VERSION, modelVersion:VERSION,
    assumptions:'Uncalibrated synthetic costs and protection. Drainage is the City resilience proxy, not water-flow physics.',
  };
  return {
    title:'Housing versus drainage · ' + POLICY_COMPARISON_VERSION,
    initial, runs:5, months:36, retention:'summary',
    scenarios:[
      {id:'baseline', interventions:[]},
      {id:'housing', interventions:[{type:'housing',districtId:'d1',amount:6,cost:840000}]},
      {id:'drainage', interventions:[{type:'resilience',districtId:'d1',amount:0.4,cost:200000}]},
    ],
    shocks:[{type:'flood',districtId:'d1',start:24,duration:3,severity:0.7}],
  };
}

// Event-time exposure matters: repaired units disappear from final damage stocks.
export const POLICY_FLOOD_QUERY = `SELECT r.scenario_id,
  COUNT(*) AS observed_flood_events,
  AVG(json_extract(e.payload_json, '$.units')) AS mean_damaged_homes,
  AVG(json_extract(e.payload_json, '$.damage')) AS mean_damage_usd
  FROM runs r JOIN system_events e ON e.run_id = r.run_id
  WHERE e.event_type = 'FLOOD_DAMAGE'
  GROUP BY r.scenario_id ORDER BY r.scenario_id`;
