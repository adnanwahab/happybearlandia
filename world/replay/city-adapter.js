import {createEngine} from '../city/engine.js';
import {VERSION,validateState} from '../city/contracts.js';
import {ReplayError} from './engine.js';
/** Complete CityState includes seed, parameters, stocks, queues and model time. */
export function createCityReplayAdapter(){
 const engine=createEngine();
 const checked=state=>{validateState(state);return structuredClone(state);};
 const advance=(state,{targetTick})=>{if(targetTick<state.month)throw new ReplayError('INVALID_TICK','Cannot advance backwards');if(targetTick-state.month>1200)throw new ReplayError('REPLAY_LIMIT','Replay exceeds 1200 monthly steps');while(state.month<targetTick)state=engine.step(state).state;return state;};
 return {domain:'world-city',modelVersion:VERSION,adapterVersion:'city-replay.v1',serialize:checked,restore:checked,advance,getTick:s=>s.month,
  applyEvent(state,event){if(event.replayKind!=='transition'||event.type!=='city.advance'||event.tick!==state.month+1)throw new ReplayError('EVENT_NOT_REPLAYABLE','City playback requires explicit monthly advance records');return engine.step(state).state;},
  recompute(state,inputs,options){if(inputs.length)throw new ReplayError('EVENT_NOT_REPLAYABLE','City intervention replay needs a versioned intervention adapter');return advance(state,options);}
 };
}
