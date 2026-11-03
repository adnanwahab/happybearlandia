/** Display calendar only. Monthly simulation ordering remains unchanged. */
export const REALITY_CLOCK_ANCHOR=Object.freeze({year:2026,month:1,day:1,source:'Explicit UI calendar assumption: modeled month 0 is January 2026; not a historical observation.'});
export function realityClock(engine,time){return{time,unit:engine==='city'?'month':'minute',anchor:engine==='city'?REALITY_CLOCK_ANCHOR:null};}
