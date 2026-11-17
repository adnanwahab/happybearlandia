import {parseContinuity,resolveContinuity,readContinuity,continuityURL,CONTINUITY_VERSION, type ContinuityPayload, type LoadedAuthority} from './contract.js';
const payload:ContinuityPayload={version:CONTINUITY_VERSION,sourceSurface:'world',authority:'test',runId:'r',checkpointId:'c',modelVersion:'m',entity:null,camera:null,clock:{id:'clock',unit:'month',origin:'epoch',tick:0}};
const loaded:LoadedAuthority={...payload,entities:[],mappings:[]};
const result=resolveContinuity(parseContinuity(payload),loaded);
if(result.status==='compatible') continuityURL('decision',result.payload);
const receipt=readContinuity('/world');
if(receipt.status==='carried') continuityURL('future-machine',receipt.payload);
// @ts-expect-error Arbitrary destinations are not supported.
continuityURL('https://elsewhere.test',payload);
// @ts-expect-error No implicit date-to-integer clock conversion.
const invalidClock:ContinuityPayload={...payload,clock:{...payload.clock,tick:'2026-01'}};
void invalidClock;
