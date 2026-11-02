import {WORLD_LIMITS,cloneWorld,detachedWorld} from './world-state.js';
/** In-memory bounded history. Checkpoints contain core state only, never history
 * recursively. No actual-person records, persistence, wall clock or timers. */
export function createWorldHistoryStore({maxEvents=1000,maxCheckpoints=2,maxMetricRows=240,state}={}){
 for(const[key,value,max]of[['maxEvents',maxEvents,WORLD_LIMITS.maxEvents],['maxCheckpoints',maxCheckpoints,WORLD_LIMITS.maxCheckpoints],['maxMetricRows',maxMetricRows,WORLD_LIMITS.maxMetricRows]])if(!Number.isInteger(value)||value<1||value>max)throw new Error(`${key} must be 1–${max}`);
 let data={schemaVersion:'world-history.v1',limits:{maxEvents,maxCheckpoints,maxMetricRows},events:[],checkpoints:[],metrics:[],sequence:0,sourceDroppedEvents:0,droppedEvents:0,droppedCheckpoints:0,droppedMetricRows:0};
 if(state){if(state.schemaVersion!=='world-history.v1')throw new Error('Unsupported world history version');data=cloneWorld(state);const l=data.limits;if(!l||!Number.isInteger(data.sequence)||data.sequence<0||!Array.isArray(data.events)||data.events.length>maxEvents||!Array.isArray(data.checkpoints)||data.checkpoints.length>maxCheckpoints||!Array.isArray(data.metrics)||data.metrics.length>maxMetricRows||l.maxEvents!==maxEvents||l.maxCheckpoints!==maxCheckpoints||l.maxMetricRows!==maxMetricRows)throw new Error('Invalid bounded world history');}
 const bounded=(key,value,limit,dropped)=>{data[key].push(cloneWorld(value));if(data[key].length>limit){data[key].shift();data[dropped]++;}};
 function retention(){return{...data.limits,eventRecords:data.events.length,eventSequence:data.sequence,firstRetainedSequence:data.events[0]?.sequence??data.sequence+1,droppedEvents:data.droppedEvents,sourceDroppedEvents:data.sourceDroppedEvents,checkpoints:data.checkpoints.map(row=>({minute:row.minute,tick:row.state.population.tick})),droppedCheckpoints:data.droppedCheckpoints,metricRows:data.metrics.length,droppedMetricRows:data.droppedMetricRows,source:'actual emissions and explicit core checkpoints; no every-frame person position history'};}
 return{
  appendEvents(events,{sourceDropped=0}={}){if(!Array.isArray(events)||!Number.isInteger(sourceDropped)||sourceDropped<0)throw new Error('Invalid history events');data.sourceDroppedEvents+=sourceDropped;for(const event of events){const sequence=++data.sequence;bounded('events',{...event,id:event.id??`world-event-${sequence}`,sequence},maxEvents,'droppedEvents');}},
  recordMetrics(minute,metrics){const row={minute,metrics:cloneWorld(metrics)},last=data.metrics.at(-1);if(last?.minute===minute)data.metrics[data.metrics.length-1]=row;else bounded('metrics',row,maxMetricRows,'droppedMetricRows');},
  checkpoint(minute,core){const row={minute,state:cloneWorld(core)},last=data.checkpoints.at(-1);if(last?.minute===minute)data.checkpoints[data.checkpoints.length-1]=row;else bounded('checkpoints',row,maxCheckpoints,'droppedCheckpoints');},
  eventsSince(cursor=0){if(!Number.isSafeInteger(cursor)||cursor<0||cursor>data.sequence)throw new Error('Event cursor must be an existing nonnegative sequence');return detachedWorld({events:data.events.filter(row=>row.sequence>cursor),cursor:data.sequence,complete:cursor>=(data.events[0]?.sequence??data.sequence+1)-1&&data.sourceDroppedEvents===0,truncated:cursor<(data.events[0]?.sequence??data.sequence+1)-1,retention:retention()});},
  nearestCheckpoint(minute){const row=[...data.checkpoints].reverse().find(row=>row.minute<=minute);return row?cloneWorld(row):null;},
  snapshot(){return detachedWorld({schemaVersion:data.schemaVersion,events:data.events,metrics:data.metrics,retention:retention()});},
  serialize(){return cloneWorld(data);}
 };
}
