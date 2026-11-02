/** Explicit legacy input mappings. Walking pace and measured outcomes are never
 * offset. Capture baseParameters once; do not compound repeated adoptions. */
export function policyToWorldInputs({effects={},id='legacy-policy',label='Legacy policy'}={},baseParameters={}){
 const parameters={},trace=[],unsupported=[];
 const number=(key,fallback)=>Number.isFinite(effects[key])?effects[key]:fallback;
 if(number('speedMult',1)!==1){parameters.transitService=Math.max(0,Math.min(4,(baseParameters.transitService??1)*number('speedMult',1)));trace.push({source:'speedMult',target:'transitService',mechanism:'service access and waiting time; walking speed unchanged'});}
 if(number('housingGrowth',0)!==0){parameters.housingCapacityMultiplier=Math.max(.5,Math.min(3,(baseParameters.housingCapacityMultiplier??1)*(1+number('housingGrowth',0))));trace.push({source:'housingGrowth',target:'housingCapacityMultiplier',mechanism:'synthetic district capacity; no physical construction claim'});}
 if(number('hiringBoost',0)!==0){parameters.hiringRate=Math.max(0,Math.min(.5,(baseParameters.hiringRate??.01)*(1+number('hiringBoost',0))));trace.push({source:'hiringBoost',target:'hiringRate'});}
 // Reset mapped inputs to the captured baseline when a policy is removed.
 for(const key of ['transitService','housingCapacityMultiplier','hiringRate'])if(parameters[key]===undefined&&Number.isFinite(baseParameters[key]))parameters[key]=baseParameters[key];
 for(const key of ['floodMitigation','voucherMonthly','parkCleanupBoost','restockBoost','groceryDelivery'])if(number(key,0)!==0)unsupported.push({input:key,reason:'No reviewed canonical mechanism mapping; legacy mechanism remains separate.'});
 return{id,label,parameters,provenance:{source:'explicit legacy-to-canonical input adapter',trace,unsupported,walkingSpeedUnchanged:true}};
}
