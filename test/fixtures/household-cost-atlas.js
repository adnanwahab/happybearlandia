import {simulateHousingRun} from '../../world/models/housing/index.js';
// Synthetic, reproducible demonstration; no empirical household allocations.
export function costAtlasFixture() {
 const input={seed:42,years:2,parameters:{voucher_funding:600000000,subsidy_amount:3000000000}};
 const experiment={id:'cost-atlas-fixture',modelId:'housing.v1',modelVersion:'1.2.0'};
 return {input,experiment,run:{...simulateHousingRun(input),id:'fixture-42',experimentId:experiment.id,scenarioId:'plan',seed:42,modelVersion:'1.2.0'}};
}
