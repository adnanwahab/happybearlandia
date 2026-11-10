import {ReplayError} from './engine.js';
/** Inject service so HTTP never silently falls back to live state. */
export function createHistoricalStateHandler({service}){
 return async function handle(request){const url=new URL(request.url);if(url.pathname!=='/api/causality/state')return null;
  if(request.method!=='GET')return Response.json({error:'METHOD_NOT_ALLOWED'},{status:405,headers:{Allow:'GET'}});
  try{const context=JSON.parse(url.searchParams.get('context')||'null'),raw=url.searchParams.get('tick');if(raw===null||!/^\d+$/.test(raw))throw new ReplayError('INVALID_TICK','tick is required');
   return Response.json(await service.stateAt({context,targetTick:Number(raw),checkpointId:url.searchParams.get('checkpointId')||undefined,mode:url.searchParams.get('mode')||'recorded-playback'}));
  }catch(error){const status=error instanceof ReplayError?(['CHECKPOINT_UNAVAILABLE'].includes(error.code)?404:409):400;return Response.json({error:error.code||'INVALID_REQUEST',message:error.message},{status});}
 };
}

export async function createStoredHistoricalStateHandler(store){
 const [{HistoricalStateService,ReplayAdapterRegistry},{createReplayRepository},{createCityReplayAdapter}]=await Promise.all([import('./engine.js'),import('./repository.js'),import('./city-adapter.js')]);
 return createHistoricalStateHandler({service:new HistoricalStateService({repository:createReplayRepository(store),registry:new ReplayAdapterRegistry().register(createCityReplayAdapter())})});
}
