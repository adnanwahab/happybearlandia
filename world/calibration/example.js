import { simulateHousingRun, housingModel } from '../models/housing/index.js';
export function syntheticRecipe() {
  const parameters = {initial_housing:1000000, initial_households:960000, initial_rent:1800, initial_income:72000, rent_response:0.8};
  const origins = [
    {id:'train', startDate:'2000-01-01', inputsAvailableAt:'2000-01-01', split:'tuning'},
    {id:'holdout', startDate:'2005-01-01', inputsAvailableAt:'2005-01-01', split:'validation'},
  ].map(origin => ({...origin, parameters:{...parameters}, label:'synthetic', source:'Generated housing fixture; no historical observations', observations:[1,3].map(years => {
    const run = simulateHousingRun({parameters:{...parameters,rent_response:1.2}, seed:42, years});
    const metrics = {median_rent:run.metrics.median_rent, housing_supply:run.metrics.housing_supply};
    return {date:`${Number(origin.startDate.slice(0,4))+years}-01-01`, availableAt:`${Number(origin.startDate.slice(0,4))+years}-02-01`, label:'synthetic', source:'housing.v1 1.2.0 generated with rent_response=1.2, seed=42', metrics, units:Object.fromEntries(Object.keys(metrics).map(key => [key,housingModel.metrics.find(row => row.id===key).unit]))};
  })}));
  return {schemaVersion:'reality-calibration-recipe.v1', id:'synthetic-demo', geography:'synthetic-metro', dollarBasis:'constant 2000 USD (synthetic)', tuningCutoff:'2005-01-01', seed:42, runs:3, origins, tuning:{parameterId:'rent_response', values:[0.4,0.8,1.2], evidenceIds:['demo-response']}, evidence:[{id:'demo-response', parameterId:'rent_response', geography:'synthetic-metro', sourceName:'Housing model mechanics — synthetic fixture', url:'https://github.com/adnanwahab/happybearlandia/blob/main/world/models/housing/README.md', availableAt:'2000-01-01', label:'synthetic', type:'heuristic', notes:'Synthetic workflow fixture. Availability date is invented for testing; this is not empirical coefficient evidence.'}]};
}
