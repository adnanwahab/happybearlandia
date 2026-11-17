export const CONTINUITY_VERSION: 'world-continuity.v1';
export const CONTINUITY_KEY: 'continuity';
export const SURFACES: Readonly<{world:'/world';'future-machine':'/world/future-machine.html';decision:'/world/decision.html'}>;
export type Surface = keyof typeof SURFACES;
export interface Entity { namespace:string; kind:string; id:string }
export interface Clock { id:string; unit:string; origin:string; tick:number }
export interface Camera { mapping:string; version:string; position:[number,number,number]; target:[number,number,number] }
export interface ContinuityPayload {
 version:typeof CONTINUITY_VERSION; sourceSurface:Surface; authority:string;
 runId:string; checkpointId:string; modelVersion:string; entity:Entity|null; camera:Camera|null; clock:Clock;
}
/** Destination-owned data, never populated from a navigation URL. */
export interface LoadedAuthority {
 authority:string; runId:string; checkpointId:string; modelVersion:string; clock:Clock;
 entities:Entity[]; mappings:{id:string;version:string}[];
}
export type Unavailable = 'invalid'|'unsupported'|'authority-mismatch'|'stale'|'model-mismatch'|'clock-mismatch'|'unresolved-entity'|'unsupported-mapping';
export function parseContinuity(value:unknown):ContinuityPayload;
export function readContinuity(input:string):{status:'carried';payload:ContinuityPayload}|{status:'missing'|'invalid';payload:null};
export function continuityURL(surface:Surface,payload:ContinuityPayload|null):string;
export function resolveContinuity(input:unknown,authority:LoadedAuthority|null):{status:'compatible';payload:ContinuityPayload}|{status:Unavailable;payload:null};
