/** Plain-language interpretation of explicitly evaluated policy-test outcomes. */
export function interpretRealityResults(result) {
  const s=result?.summary??{}, runs=Array.isArray(result?.runs)?result.runs:[],goals=result?.manifest?.tests??[];
  const completed=Number(s.completed)||0,requested=Number(s.requested)||runs.length,errors=Number(s.errors)||0,passed=Number(s.passed)||0;
  const failed=Number(s.failed)||0,unavailable=Number(s.unavailable)||0;
  const missed=new Map();
  for(const run of runs) {
    if(run?.status!=='completed'||run.pass!==false)continue;
    for(const test of run.tests??[]) if(test.status==='fail') {
      const key=String(test.id??test.metric??'unspecified');
      missed.set(key,(missed.get(key)||0)+1);
    }
  }
  const common=[...missed].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,3)
    .map(([id,count])=>{
      const test=goals.find(t=>t.id===id);
      const label=test?.metric??test?.then?.metric??id;
      const op=test?.operator??test?.then?.operator??'';
      const threshold=test?.threshold??test?.then?.threshold;
      const target=Number.isFinite(threshold)?' ('+op+' '+threshold+(test?.unit?' '+test.unit:'')+')':'';
      return label+target+' missed in '+count+' completed futures';
    });
  if(!completed) return {
    status:'no-completed-runs',
    title:'No complete futures to interpret yet.',
    message:errors?errors+' simulation runs could not complete. Open the error details before changing the policy.':'The simulation has not completed any paired futures yet.',
    details:common,
  };
  if(!goals.length) return{status:'untested',title:completed+' simulated futures completed.',message:'No policy success tests were declared. Compare the outcomes; do not interpret them as passed or failed goals.',details:[]};
  if(!passed) return {
    status:'no-goals-met',
    title:completed+' futures simulated; 0 met every goal.',
    message:'This does not mean all '+completed+' simulations crashed. '+failed+' completed future(s) missed at least one policy target.'+
      (unavailable?' '+unavailable+' had unavailable tests.':'')+(errors?' '+errors+' execution errors also occurred.':'')+
      ' Try one smaller, measurable change, relax a target deliberately, or inspect a nonpassing future.',
    details:common,
  };
  return {
    status:passed===completed?'all-passed':'mixed',
    title:passed+' of '+completed+' completed futures met every goal.',
    message:'These are outcomes of a synthetic simulation under declared tests, not a probability of real-world success.'+
      (errors?' '+errors+' execution error(s) were separate from nonpassing policy tests.':''),
    details:common,
  };
}
