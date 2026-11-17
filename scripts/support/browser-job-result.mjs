/** A zero exit alone does not prove tests ran. Skips/flaky retries are incomplete. */
export function browserJobStatus(exitCode,stats){
 if(exitCode!==0)return 'failed';
 if(!stats||!Number.isInteger(stats.expected)||stats.expected<=0||stats.skipped||stats.flaky||stats.unexpected)return 'incomplete';
 return 'passed';
}
/** Connection endpoints are local capabilities, not acceptance evidence. */
export function redactBrowserEndpoints(value){
 if(Array.isArray(value))return value.map(redactBrowserEndpoints);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,key==='wsEndpoint'?'[redacted]':redactBrowserEndpoints(item)]));
 return value;
}
