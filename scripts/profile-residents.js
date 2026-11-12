// bun --cpu-prof-md --cpu-prof-dir=/private/tmp scripts/profile-residents.js
import {createPopulationModel,stepPopulation} from '../world/population/model.js';
const model=createPopulationModel({population:100000,seed:42},{districts:[{id:'home',x:0,z:0,transit:.6,services:.7},{id:'jobs',x:1800,z:0,transit:.8,services:.8}]},{initialMinute:360,initialTick:360});
for(let tick=361;tick<=376;tick++)stepPopulation(model,{tick,minutes:1});
