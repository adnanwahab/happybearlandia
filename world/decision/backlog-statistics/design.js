export const VERSION = 'balanced-statistics.v1';
const finite = x => typeof x === 'number' && Number.isFinite(x);
const mean = xs => xs.reduce((a,b) => a+b,0)/xs.length;
export function createFactorialDesign({factors,seeds,budget=128,distribution='independent-discrete-uniform'}={}) {
  if(distribution!=='independent-discrete-uniform') throw Error('Only independent equal-weight discrete levels supported');
  if(!Number.isInteger(budget)||budget<1||budget>128) throw Error('Budget must be 1–128');
  if(!Array.isArray(factors)||factors.length<1||factors.length>3||new Set(factors.map(f=>f.id)).size!==factors.length) throw Error('Use 1–3 unique factors');
  for(const f of factors) if(!f.id||!Array.isArray(f.levels)||f.levels.length<2||f.levels.length>5||f.levels.some(v=>!finite(v))||new Set(f.levels).size!==f.levels.length) throw Error('Use 2–5 distinct finite levels per factor');
  if(!Array.isArray(seeds)||!seeds.length||seeds.length>8||new Set(seeds).size!==seeds.length||seeds.some(s=>!Number.isInteger(s)||s<0||s>4294967295)) throw Error('Use 1–8 unique uint32 seeds');
  const cells=factors.reduce((rows,f)=>rows.flatMap(r=>f.levels.map(v=>({...r,[f.id]:v}))),[{}]);
  if(cells.length*seeds.length>budget) throw Error('Complete crossed design exceeds budget; cannot truncate');
  return {version:VERSION,factors:structuredClone(factors),seeds:[...seeds],distribution,budget,cells,evaluations:cells.length*seeds.length};
}
export async function evaluateFactorial(options,evaluate,{signal,onProgress}={}) {
  const design=createFactorialDesign(options),evaluations=[];
  if(typeof evaluate!=='function') throw Error('Actual evaluator required');
  for(let cell=0;cell<design.cells.length;cell++) for(const seed of design.seeds) {
    if(signal?.aborted) return {design,evaluations,available:false,status:'cancelled',components:null};
    try {const value=await evaluate({parameters:{...design.cells[cell]},seed,cell}); if(!finite(value)) throw Error('Missing finite metric'); evaluations.push({cell,seed,value,status:'completed'});}
    catch(e){evaluations.push({cell,seed,value:null,status:'failed',error:String(e.message||e)});}
    onProgress?.({completed:evaluations.length,total:design.evaluations});
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  if(evaluations.some(r=>r.status!=='completed')) return {design,evaluations,available:false,status:'incomplete',components:null};
  const ys=design.cells.map((_,cell)=>mean(evaluations.filter(r=>r.cell===cell).map(r=>r.value)));
  const grandMean=mean(ys),totalVariance=mean(ys.map(y=>(y-grandMean)**2)),components=[];
  for(let mask=1;mask<2**design.factors.length;mask++) {
    const ids=design.factors.filter((_,i)=>mask&(1<<i)).map(f=>f.id),groups=new Map();
    design.cells.forEach((cell,i)=>{const key=JSON.stringify(ids.map(id=>cell[id])); if(!groups.has(key)) groups.set(key,[]);groups.get(key).push(ys[i]);});
    const closed=mean([...groups.values()].map(v=>(mean(v)-grandMean)**2));
    const variance=Math.max(0,closed-components.filter(c=>(c.mask&mask)===c.mask).reduce((s,c)=>s+c.variance,0));
    components.push({mask,factors:ids,variance,share:totalVariance>0?variance/totalVariance:null});
  }
  return {design,evaluations,available:true,status:'completed',grandMean,totalVariance,components,method:'Exact finite-product ANOVA of matched-seed mean responses, population denominator N. Equal-weight independent chosen levels.',limitations:'Design variance conditional on chosen levels, fixed other inputs and declared seeds. Not empirical calibration, predictive certainty, or a stochastic shock variance partition.'};
}
