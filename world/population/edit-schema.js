/** Living City UI proposals are bounded data, not provider/code operations.
 * Manual controls validate then explicitly RESET/RESEED the behavioral runtime.
 * Bundles/designed experiments remain detached until a user approval click.
 */
import {defaultPopulationConfig,populationConfigSchema,populationParameters,validatePopulationConfig} from './contracts.js';
export const POPULATION_EDIT_VERSION='population-edit.v1';
export const POPULATION_POLICY_PACKAGES=[
 {id:'transit-oriented-growth',name:'Transit-oriented growth',description:'Increase housing capacity and transit supply; test the resulting modeled household and mode choices.',changes:{housingCapacityMultiplier:1.25,transitService:2,transitCapacity:900}},
 {id:'affordability-buffer',name:'Affordable housing package',description:'Reduce the rent multiplier and moving costs; retain the same synthetic population seed.',changes:{rentMultiplier:.85,movingCost:1000}},
 {id:'workforce-access',name:'Workforce access',description:'Increase the modeled hiring rate, wages and transit service together; no claim of real jobs created.',changes:{hiringRate:.02,wageMultiplier:1.1,transitService:1.5}},
];
export function populationConfigDiff(before,after){
 const rows=[];for(const p of populationParameters)if(before?.[p.id]!==after?.[p.id])rows.push({id:p.id,label:p.label,unit:p.unit,from:before?.[p.id]??p.default,to:after?.[p.id]??p.default});
 if(JSON.stringify(before?.events||[])!==JSON.stringify(after?.events||[]))rows.push({id:'events',label:'Scheduled behavior events',unit:'events',from:structuredClone(before?.events||[]),to:structuredClone(after?.events||[])});
 return rows;
}
export function createPopulationEdit(config,changes,{summary='Review living-city configuration',source='manual-policy-package'}={}){
 const checked=validatePopulationConfig({...structuredClone(config||defaultPopulationConfig),...structuredClone(changes)});
 if(!checked.valid)throw new Error(checked.errors.join(' '));
 return{schemaVersion:POPULATION_EDIT_VERSION,summary,source,baseConfig:JSON.stringify(config),config:checked.values,changes:populationConfigDiff(config,checked.values),warnings:['Synthetic behavior model; coefficients are illustrative, not empirically calibrated.','Applying these settings resets/reseeds the behavior runtime. Existing housing experiments remain unchanged.']};
}
export function validatePopulationEdit(proposal,config){
 const errors=[];if(proposal?.schemaVersion!==POPULATION_EDIT_VERSION)errors.push('Unsupported population edit proposal.');
 if(proposal?.baseConfig!==JSON.stringify(config))errors.push('Settings changed after preview. Review a new proposal before approval.');
 const checked=validatePopulationConfig(proposal?.config||{});errors.push(...checked.errors);
 return{valid:errors.length===0,errors,values:checked.values};
}
export function createPopulationExperiment(config,{leverA='roadCapacity',valueA,leverB='transitService',valueB,runs=3,days=2}={}){
 if(!Number.isInteger(runs)||runs<1||runs>6||!Number.isInteger(days)||days<1||days>14)throw new Error('Compare 1–6 paired seeds over 1–14 modeled days.');
 const definitionA=populationParameters.find(p=>p.id===leverA),definitionB=populationParameters.find(p=>p.id===leverB);
 if(!definitionA||!definitionB||['population','seed','maxLogEntries'].includes(leverA)||['population','seed','maxLogEntries'].includes(leverB))throw new Error('Choose two modeled behavioral policy inputs.');
 const a=validatePopulationConfig({...config,[leverA]:valueA??definitionA.default}),b=validatePopulationConfig({...config,[leverB]:valueB??definitionB.default});
 if(!a.valid||!b.valid)throw new Error([...a.errors,...b.errors].join(' '));
 return{schemaVersion:'population-experiment.v1',name:'Paired living-city policy comparison',seed:config.seed,runs,days,minutes:days*1440,population:Math.min(config.population,2000),scenarios:[{id:'baseline',name:'Current settings',config:structuredClone(config)},{id:'policy-a',name:definitionA.label,config:a.values},{id:'policy-b',name:definitionB.label,config:b.values}],notes:['Same per-index seeds across alternatives.','Bounded experiment population is disclosed; it is not the full live city unless sizes match.','No experiment runs before explicit approval.']};
}
export {populationConfigSchema};
