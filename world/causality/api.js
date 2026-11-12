import {createStoredPairedComparisonHandler} from '../paired-comparison-api.js';
import {createWorldCausalScenarioHandler} from '../causal/api.js';
import {createWorldPersistenceStore} from '../experiments/persistence-store.js';
import {resolveWorldDatabasePath} from '../experiments/database-path.js';
import {createCausalityReadHandler} from './read-api.js';
import {HistoricalStateService,ReplayAdapterRegistry} from '../replay/engine.js';
import {createReplayRepository} from '../replay/repository.js';
import {createCityReplayAdapter} from '../replay/city-adapter.js';
import {createHistoricalStateHandler} from '../replay/api.js';
import {createCounterfactualHandler} from '../counterfactual/api.js';
/** Single modular registration point. Dependencies can be replaced by authorized hosts. */
export function createCausalityHandler({store,dbPath,extensions=[],forkHandler=createCounterfactualHandler()}={}) {
 let owned,handlers;
 return async request=>{
  const path=new URL(request.url).pathname;
  if(path!=='/api/causality'&&!path.startsWith('/api/causality/'))return null;
  try{
   if(!handlers){const records=store||(owned=createWorldPersistenceStore(dbPath??resolveWorldDatabasePath())).causality;
    const service=new HistoricalStateService({repository:createReplayRepository(records),registry:new ReplayAdapterRegistry().register(createCityReplayAdapter())});
    handlers=[...extensions,createWorldCausalScenarioHandler({store:records}),async request=>new URL(request.url).pathname==='/api/causality/compare'?createStoredPairedComparisonHandler({store:records})(request):null,createHistoricalStateHandler({service}),createCausalityReadHandler({store:records})];
   }
   if(/^\/api\/causality\/(forks|jobs)(\/|$)/.test(path))return forkHandler(request);
   for(const handle of handlers){const response=await handle(request);if(response)return response;}
   return Response.json({error:'Causality endpoint not found'},{status:404});
  }catch{return Response.json({error:'Causal persistence unavailable'},{status:503});}
 };
}
