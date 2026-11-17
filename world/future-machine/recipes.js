import { DEFAULT_RECIPE } from './contracts.js';
import { freeze } from './data/core.js';

// Authored inputs only: outcomes always come from the monthly City engine.
export const PLAYABLE_RECIPES = freeze([
  {id:'small-infill',title:'Small infill',description:'Propose 6 homes in d1 for 250,000 illustrative USD, without an added governance delay.',recipe:{...DEFAULT_RECIPE,intervention:{...DEFAULT_RECIPE.intervention,amount:6,cost:250000}}},
  {id:'district-expansion',title:'District expansion',description:'Propose 24 homes in d2 for 1,000,000 illustrative USD, without an added governance delay.',recipe:{...DEFAULT_RECIPE,intervention:{...DEFAULT_RECIPE.intervention,districtId:'d2'}}},
  {id:'delayed-housing',title:'Housing after a wait',description:'Propose 12 homes in d1 for 500,000 illustrative USD with 48 months of governance delay.',recipe:{...DEFAULT_RECIPE,intervention:{...DEFAULT_RECIPE.intervention,amount:12,cost:500000,delay:48}}},
].map(entry=>({...entry,catalogVersion:'city-what-if-recipes.v1',datasetVersion:'future-machine-synthetic.v1',source:'Authored synthetic inputs using the supported City housing intervention.',limitations:'Synthetic, uncalibrated model; illustrative costs are scenario assumptions, not cost estimates. Funding and construction constrain completion. No private development, annual growth, or real geography; utility capacity 200 per district/network. These examples vary multiple inputs and do not isolate the effect of one parameter.'})));
