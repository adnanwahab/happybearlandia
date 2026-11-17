// Deterministic display fixture, not empirical data or output claimed from a model run.
export function tideFixture() {
  return { version:'futures-1', cfg:{years:3,step:1}, futures:Array.from({length:100},(_,index)=>({index,seed:`fixture:reality:${index}`,simYears:[1,2,3],years:Object.fromEntries([1,2,3].map(year=>[year,{baseline:{avgMood:index+year},plans:[{avgMood:index+year+10}]}]))})) };
}
