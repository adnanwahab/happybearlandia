import {validateHouseRoommates} from '../house/roommates.js';
import {validateHouseProfiles} from '../house/profiles.js';
import {validateHouseParties} from '../house/party.js';
import {validateHouseLife} from '../house/life-systems.js';
import {validateHouseRelationships} from '../house/relationships.js';
import {validateHouseBuild} from '../house/build-adapter.js';
import {validateBasicNeeds} from '../house/basic-needs.js';
import {validateTaskQueues} from '../house/task-queue.js';
import {validateVisitState} from '../house/visits.js';
import {validateHouseState} from '../house/model.js';
import {POPULATION_VERSION,validatePopulationConfig} from './contracts.js';
export const CHECKPOINT_VERSION='population-checkpoint.v1';
export const MAX_CHECKPOINT_BYTES=32*1024*1024;
const constructors={Int8Array,Uint8Array,Uint8ClampedArray,Int16Array,Uint16Array,Int32Array,Uint32Array,Float32Array,Float64Array};
const fail=()=>{throw new Error('Invalid or oversized population checkpoint');};
function size(value){let json;try{json=JSON.stringify(value);}catch{fail();}if(new TextEncoder().encode(json).length>MAX_CHECKPOINT_BYTES)fail();return json;}
function base64(bytes){let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);}
/** Explicit graph encoding preserves shared typed-array aliases and IEEE bytes.
 * Constructor names are an allowlist; input never selects arbitrary globals. */
export function encodeCheckpointGraph(root){
 const nodes=[],seen=new Map();
 function encode(value,depth=0){if(depth>128)fail();if(value===undefined)return['u'];if(Object.is(value,-0))return['n','-0'];if(typeof value==='number'&&!Number.isFinite(value))return['n',String(value)];if(value===null||['string','number','boolean'].includes(typeof value))return value;if(typeof value!=='object')fail();if(seen.has(value))return['r',seen.get(value)];if(nodes.length>=500000)fail();const id=nodes.length;seen.set(value,id);nodes.push(null);let node;
 if(ArrayBuffer.isView(value)){if(!constructors[value.constructor.name])fail();node=['t',value.constructor.name,base64(new Uint8Array(value.buffer,value.byteOffset,value.byteLength))];}
 else if(value instanceof ArrayBuffer)node=['b',base64(new Uint8Array(value))];
 else if(Array.isArray(value))node=['a',value.map(v=>encode(v,depth+1))];
 else if(value instanceof Map)node=['m',[...value].map(([k,v])=>[encode(k,depth+1),encode(v,depth+1)])];
 else if(value instanceof Set)node=['s',[...value].map(v=>encode(v,depth+1))];
 else if(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null)node=['o',Object.entries(value).map(([k,v])=>[k,encode(v,depth+1)])];else fail();nodes[id]=node;return['r',id];
 }
 const graph={root:encode(root),nodes};size(graph);return graph;
}
export function decodeCheckpointGraph(graph){
 size(graph);if(!graph||!Array.isArray(graph.nodes)||graph.nodes.length>500000)fail();const objects=new Array(graph.nodes.length),status=new Uint8Array(graph.nodes.length);
 function decode(value,depth=0){if(depth>128)fail();if(value===null||['string','boolean'].includes(typeof value)||typeof value==='number'&&Number.isFinite(value))return value;if(!Array.isArray(value))fail();if(value[0]==='u'&&value.length===1)return undefined;if(value[0]==='n'&&value.length===2&&['NaN','Infinity','-Infinity','-0'].includes(value[1]))return Number(value[1]);if(value[0]!=='r'||value.length!==2||!Number.isInteger(value[1])||value[1]<0||value[1]>=objects.length)fail();const id=value[1];if(status[id])return objects[id];const node=graph.nodes[id];if(!Array.isArray(node))fail();const [kind,data,bytes]=node;let object;
 if(kind==='t'||kind==='b'){if(kind==='t'&&!Object.hasOwn(constructors,data))fail();const encoded=kind==='t'?bytes:data;if(typeof encoded!=='string'||encoded.length>MAX_CHECKPOINT_BYTES*4/3)fail();let raw;try{raw=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));}catch{fail();}const ctor=constructors[data];if(kind==='t'&&raw.byteLength%ctor.BYTES_PER_ELEMENT)fail();object=kind==='t'?new ctor(raw.buffer):raw.buffer;}
 else if(['a','o','m','s'].includes(kind)&&Array.isArray(data))object=kind==='a'?[]:kind==='m'?new Map():kind==='s'?new Set():{};else fail();objects[id]=object;status[id]=1;
 if(kind==='a')for(const v of data)object.push(decode(v,depth+1));if(kind==='s')for(const v of data)object.add(decode(v,depth+1));if(kind==='o'||kind==='m')for(const pair of data){if(!Array.isArray(pair)||pair.length!==2)fail();if(kind==='m')object.set(decode(pair[0],depth+1),decode(pair[1],depth+1));else{if(typeof pair[0]!=='string'||['__proto__','constructor','prototype'].includes(pair[0])||Object.hasOwn(object,pair[0]))fail();object[pair[0]]=decode(pair[1],depth+1);}}return object;
 }
 return decode(graph.root);
}
export function createPopulationCheckpoint(state){const checkpoint={schemaVersion:CHECKPOINT_VERSION,modelVersion:POPULATION_VERSION,encoding:'typed-graph.v1',state:encodeCheckpointGraph(state)};size(checkpoint);return checkpoint;}
export function readPopulationCheckpoint(checkpoint){size(checkpoint);if(checkpoint?.schemaVersion!==CHECKPOINT_VERSION||checkpoint.modelVersion!==POPULATION_VERSION||checkpoint.encoding!=='typed-graph.v1')throw new Error('Unsupported population checkpoint version');const state=decodeCheckpointGraph(checkpoint.state),r=state?.runtime,m=state?.model;const checked=validatePopulationConfig(m?.config||{});if(!m||m.schemaVersion!=='population-state.v1'||m.modelVersion!==POPULATION_VERSION||!checked.valid||!(m.people?.age instanceof Uint8Array)||m.people.age.length!==checked.values.population||!r||!Number.isInteger(r.initialMinute??0)||(r.initialMinute??0)<0||(r.initialMinute??0)>=1440||(r.initialMinute??0)>m.minute||(r.initialMinute??0)%r.stepMinutes!==0||!Number.isSafeInteger(r.tick)||r.tick<0||!Number.isInteger(r.stepMinutes)||r.stepMinutes<1||r.stepMinutes>1440||m.minute!==r.tick*r.stepMinutes||!['ticks-per-poll','minutes-per-second'].includes(r.clockMode)||r.clockMode==='minutes-per-second'&&r.stepMinutes!==1||typeof r.paused!=='boolean'||!Number.isFinite(r.speed)||r.speed<.25||r.speed>32||!Array.isArray(r.series)||r.series.length>240||!Array.isArray(r.socialTimeline)||!Array.isArray(r.movementTimeline??[])||(r.movementTimeline??[]).length>256||!Array.isArray(r.householdTimeline??[])||(r.householdTimeline??[]).length>256||!Array.isArray(r.weatherTimeline)||!state.weatherOwner)fail();validateVisitState(m);validateHouseState(m);validateBasicNeeds(m);validateTaskQueues(m);validateHouseBuild(m);validateHouseRelationships(m);validateHouseLife(m);validateHouseParties(m);validateHouseProfiles(m);validateHouseRoommates(m);return state;}
