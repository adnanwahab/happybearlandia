export const VERSION = 'balanced-statistics.v1';
const finite = x => typeof x === 'number' && Number.isFinite(x);
// Neumaier summation, with an offset to preserve small design effects on
// large absolute outcomes. Overflow is detected below, never reported as data.
function sum(xs) {
  let total = 0, correction = 0;
  for (const value of xs) {
    const next = total + value;
    correction += Math.abs(total) >= Math.abs(value) ? (total - next) + value : (value - next) + total;
    total = next;
  }
  return total + correction;
}
const mean = xs => xs[0] + sum(xs.map(x => (x - xs[0]) / xs.length));
export const VARIANCE_TOLERANCE = { relative: 1e-10, absolute: 1e-12 };
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
  if (signal?.aborted) return {design,evaluations,available:false,status:'cancelled',components:null};
  const ys = design.cells.map((_,cell) => mean(evaluations.filter(r => r.cell === cell).map(r => r.value)));
  const offset = ys[0], centered = ys.map(y => y - offset);
  const centerMean = mean(centered), grandMean = offset + centerMean;
  const totalVariance = mean(centered.map(y => (y - centerMean) ** 2));
  const components = [], effects = new Map();
  for (let mask = 1; mask < 2 ** design.factors.length; mask++) {
    const ids = design.factors.filter((_,i) => mask & (1 << i)).map(f => f.id);
    const keyFor = cell => JSON.stringify(ids.map(id => cell[id]));
    const groups = new Map();
    design.cells.forEach((cell,i) => {
      const key = keyFor(cell);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(centered[i]);
    });
    const conditional = new Map([...groups].map(([key,values]) => [key, mean(values)]));
    // Compute orthogonal effects directly instead of subtracting nearly equal
    // variances, which can erase small genuine interaction components.
    const effect = design.cells.map((cell,i) => conditional.get(keyFor(cell)) - centerMean -
      sum([...effects].filter(([subset]) => (subset & mask) === subset).map(([,values]) => values[i])));
    effects.set(mask, effect);
    const variance = mean(effect.map(value => value ** 2));
    components.push({mask,factors:ids,variance,share:totalVariance > 0 ? variance / totalVariance : null});
  }
  const componentTotal = sum(components.map(c => c.variance));
  const tolerance = Math.max(VARIANCE_TOLERANCE.absolute, VARIANCE_TOLERANCE.relative * totalVariance);
  const residual = totalVariance - componentTotal;
  const reconstruction = {componentTotal,residual,tolerance,...VARIANCE_TOLERANCE};
  if (![grandMean,totalVariance,componentTotal,residual].every(finite) || Math.abs(residual) > tolerance || components.some(c => !finite(c.variance))) {
    return {design,evaluations,available:false,status:'numerical-failure',components:null,reconstruction};
  }
  return {design,evaluations,available:true,status:'completed',grandMean,totalVariance,components,reconstruction,method:'Exact finite-product ANOVA of matched-seed mean responses, population denominator N. Equal-weight independent chosen levels.',limitations:'Design variance conditional on chosen levels, fixed other inputs and declared seeds. Not empirical calibration, predictive certainty, or a stochastic shock variance partition.'};
}
