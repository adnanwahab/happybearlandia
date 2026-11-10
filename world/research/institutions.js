import { canonicalId, NavigationContextSchema } from '../../shared/causality/index.js';
// Facilities are contextual destinations, not claims of observed buildings or city effects.
const rows = [
 ['riskuniverse','Risk Institute','portfolio risk','Change weights, volatility, correlation and seed; compare tail attribution.', 'Correlated geometric Brownian motion; illustrative returns, no investment forecast.', ['portfolio multiple','fractional loss'], 'Existing paired CPU path check; see numerical checks in the lab.'],
 ['monte-carlo','Probability Studio','sampling uncertainty','Change seed and sample budget; watch convergence and compare the notebook.', 'Pseudo-random quarter-circle sampling; approximate normal confidence interval.', ['dimensionless'], 'CPU fallback; sampling error against π is not a GPU tolerance.'],
 ['evolution','Optimization Institute','candidate search','Change population, mutation and seed; inspect fitness over generations.', 'Synthetic Rastrigin search; convergence does not establish a global optimum.', ['fitness'], 'CPU fitness fallback; no cross-backend tolerance asserted.'],
 ['epidemics','Public Health Lab','outbreak ensembles','Change transmission and recovery; compare independent synthetic outbreaks.', 'Simplified compartmental epidemic model; no real surveillance or calibrated forecast.', ['people','days'], 'No paired CPU validation exposed by the existing lab.'],
 ['particles','Physics Studio','particle motion','Change attraction and integration steps; inspect displacement and reflective bounds.', 'Independent toy particles; not a calibrated city physics model.', ['normalized position','steps'], 'Finite output and reflective-bound checks; no CPU equivalence assertion.'],
 ['molecular-docking','Molecular Institute','pose scoring','Change candidate poses and seed; inspect ranked synthetic docking scores.', 'Illustrative receptor and scoring function; no binding affinity or drug discovery claim.', ['score'], 'Use existing lab checks; no validated physical affinity tolerance.'],
 ['astronomy','Signal Observatory','periodic signals','Change injected frequency and noise; compare recovered frequency and trial grid.', 'Synthetic signal injection; a recovered peak is not an astronomical discovery.', ['cycles / observation','power'], 'Peak power CPU reference: max(0.001, 1% of reference).'],
 ['climate','Climate Institute','energy balance','Change forcing and parameter spread; compare ensemble quantiles and CSV.', 'Two-layer energy balance ensemble; not a regional weather forecast.', ['°C','W/m²','years'], 'First member year-100 CPU temperature absolute tolerance 0.001 °C.'],
 ['security-viz-lab','Security Institute','synthetic telemetry','Choose one of six investigations; filter and inspect linked synthetic records.', 'Synthetic local datasets; no production incident or verified threat discovery.', ['bytes','packets','events'], 'Visualization prototypes; no scientific numerical tolerance asserted.'],
];
export const INSTITUTIONS = Object.freeze(rows.map(([appId,name,topic,interactions,limitations,units,reference])=>Object.freeze({appId,id:canonicalId('facility','research',appId),name,topic,interactions,limitations,units:Object.freeze(units),reference,cityEffects:false,evidence:'synthetic'})));
export const getInstitution = id => INSTITUTIONS.find(x=>x.appId===id || x.id===id);
export function assertCityEffectAllowed() { throw new Error('Research outputs cannot mutate World: no validated explicit city adapter is registered.'); }
function stable(value) {
 if (value===null || typeof value!=='object') { if(typeof value==='number'&&!Number.isFinite(value))throw new TypeError('Nonfinite input'); return JSON.stringify(value); }
 if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
 return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';
}
export async function contentHash(value) {
 const bytes=new TextEncoder().encode(stable(value));
 return 'sha256:'+Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
}
export async function createExperimentRecord({appId,context,inputs,outputs,backend,seed,modelHash}) {
 const facility=getInstitution(appId);if(!facility)throw new TypeError('Unknown research institution');
 if(!['CPU','WebGPU','unreported'].includes(backend))throw new TypeError('Unrecognized backend');
 if(seed!==null&&(!Number.isSafeInteger(seed)||seed<0||seed>4294967295))throw new TypeError('Invalid seed');
 if(!/^sha256:[a-f0-9]{64}$/.test(modelHash))throw new TypeError('Missing model hash');
 return {id:canonicalId('experiment','research',crypto.randomUUID()),facilityId:facility.id,appId,context:NavigationContextSchema.parse(context),recordedAt:new Date().toISOString(),kind:'display-snapshot',evidence:'synthetic',seed,backend,model:appId,modelHash,inputHash:await contentHash(inputs),inputs:structuredClone(inputs),outputs:structuredClone(outputs),units:facility.units,limitations:facility.limitations,reference:facility.reference,validation:'not independently validated',cityEffects:false};
}
