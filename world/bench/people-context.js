// Shared synthetic geography for browser throughput and headless diagnostics.
export function peopleBenchmarkContext(){
 return {id:'explicit-synthetic-benchmark',districts:[{id:'home',label:'Synthetic home district',x:0,z:0,transit:.6,services:.7},{id:'jobs',label:'Synthetic employment district',x:1800,z:0,transit:.8,services:.8}],provenance:{type:'synthetic-benchmark',calibrated:false}};
}
