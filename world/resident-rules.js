/** Optional compatible rule extensions. Null/absence identifies earlier saves;
 * unknown manifests must reject before a state authority changes any state. */
export const POPULATION_RESIDENT_RULES=Object.freeze({pedestrian:'sidewalks.v1',encounters:'resident-encounters.v1'});
export const LEGACY_RESIDENT_RULES=Object.freeze({pedestrian:'sidewalks.v1',encounters:'legacy-resident-encounters.v1'});
export function validateResidentRules(rules,authority='population'){
 if(rules==null)return null;
 const expected=authority==='legacy'?LEGACY_RESIDENT_RULES:POPULATION_RESIDENT_RULES;
 if(typeof rules!=='object'||Array.isArray(rules)||Object.getPrototypeOf(rules)!==Object.prototype||Object.keys(rules).length!==2||Object.keys(expected).some(key=>rules[key]!==expected[key]))throw new Error(`Unsupported ${authority} resident rules manifest`);
 return rules;
}
