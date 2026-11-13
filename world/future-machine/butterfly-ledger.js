import {DEFAULT_RECIPE, assertMonth, METRIC_UNITS} from './contracts.js';
import {createExperiment} from './data/index.js';
import {stateHash} from './data/core.js';
import {createShareURL} from './share/index.js';

export const ABLATIONS = Object.freeze({amount:12,cost:500000,delay:12,compliance:0.5});
export async function supportsLedger(recipe) { return await stateHash(recipe) === await stateHash(DEFAULT_RECIPE); }
const ticks = value => {
  if (!Number.isFinite(value) || !Number.isSafeInteger(Math.round(value * 1000))) throw new Error('Ledger measurement unavailable');
  return Math.round(value * 1000);
};
/** Integer thousandths reconcile exactly at the displayed precision. These are
 * local one-at-a-time contrasts, not an additive causal decomposition. */
export function attributeOutcomes(baseline, full, ablated) {
  if (![baseline,full,...Object.keys(ABLATIONS).map(input=>ablated[input])].every(Number.isFinite)) throw new Error('Ledger measurement unavailable');
  const observed = ticks(full - baseline);
  const rows = Object.keys(ABLATIONS).map(input => ({input, contribution:ticks(full - ablated[input])}));
  rows.sort((a,b)=>Math.abs(b.contribution)-Math.abs(a.contribution)||a.input.localeCompare(b.input));
  const sum = rows.reduce((total,row)=>total+row.contribution,0);
  const residual = observed - sum;
  if (![sum,residual].every(Number.isSafeInteger)) throw new Error('Ledger exceeds exact precision');
  return {observed,rows,residual,residualDominates:Math.abs(residual)>Math.max(...rows.map(row=>Math.abs(row.contribution)))};
}
export async function runLedger(history,{month=120,metric='meanRent',signal,onProgress,run=createExperiment,baseURL=globalThis.location?.href}={}) {
  assertMonth(month);
  if (!await supportsLedger(history.recipe)) throw new Error('Butterfly Ledger prototype requires the default recipe');
  if (!Object.hasOwn(METRIC_UNITS,metric)) throw new Error('Unsupported ledger metric');
  const receipt = async h => ({seed:h.seed,modelVersion:h.modelVersion,recipeHash:await stateHash(h.recipe),initialHash:h.initialHash,experimentId:h.experimentId,
    replayURL:createShareURL({recipe:h.recipe,experimentId:h.experimentId,month},baseURL)});
  const receipts={},values={};
  for (const [input,value] of Object.entries(ABLATIONS)) {
    signal?.throwIfAborted();
    onProgress?.(`Testing ${input} (${Object.keys(values).length+1}/4)…`);
    const recipe={...history.recipe,intervention:{...history.recipe.intervention,[input]:value}};
    const arm=await run(recipe,{signal});
    signal?.throwIfAborted();
    if (arm.seed!==history.seed||arm.modelVersion!==history.modelVersion||arm.initialHash!==history.initialHash||await stateHash(arm.recipe)!==await stateHash(recipe)) throw new Error('Ablation run identity mismatch');
    const control=arm.baseline?.[month]?.metrics?.[metric];
    if (!Number.isFinite(control)||control!==history.baseline?.[month]?.metrics?.[metric]) throw new Error('Matched control mismatch');
    values[input]=arm.plan?.[month]?.metrics?.[metric];
    receipts[input]=await receipt(arm);
  }
  return {...attributeOutcomes(history.baseline?.[month]?.metrics?.[metric],history.plan?.[month]?.metrics?.[metric],values),
    month,metric,unit:METRIC_UNITS[metric],receipts,fullReceipt:await receipt(history)};
}
export function mountLedger(container,history,{month,metric}) {
  const controller=new AbortController(),section=document.createElement('section');
  section.className='fm-ledger';
  const button=document.createElement('button'),status=document.createElement('p');
  button.textContent='Open Butterfly Ledger';
  section.append(button,status);container.append(section);
  button.onclick=async()=>{
    button.disabled=true;
    try {
      const ledger=await runLedger(history,{month,metric,signal:controller.signal,onProgress:text=>status.textContent=text});
      if(controller.signal.aborted)return;
      status.textContent=`Butterfly Ledger · model attribution under stated assumptions · Month ${month}. Full minus single-input ablation; ranked by absolute contribution. Contributions + interaction residual = ${ (ledger.observed/1000).toFixed(3)} ${ledger.unit}. Values reconcile exactly in integer thousandths; rounding is included in the residual. Residual also includes omitted effects and reference differences; it is not a pure interaction estimate. Replays recompute saved manifests. Synthetic, uncalibrated; not empirical causation.`;
      const add=(label,value,receipt)=>{
        const row=document.createElement('p'),bar=document.createElement('meter'),link=document.createElement('a');
        bar.min=0;bar.max=Math.max(1,Math.abs(ledger.residual),...ledger.rows.map(r=>Math.abs(r.contribution)));bar.value=Math.abs(value);bar.setAttribute('aria-label',`${label} absolute contribution`);
        link.href=receipt.replayURL;link.textContent=`${label}: ${(value/1000).toFixed(3)} ${ledger.unit} · replay / receipt · seed ${receipt.seed} · ${receipt.modelVersion} · recipe ${receipt.recipeHash} · run ${receipt.experimentId}`;
        row.append(bar,' ',link);section.append(row);
      };
      for(const row of ledger.rows)add(`${row.input}: ${history.recipe.intervention[row.input]} → ${ABLATIONS[row.input]}`,row.contribution,ledger.receipts[row.input]);
      add('Interaction residual (full-plan reference)',ledger.residual,ledger.fullReceipt);
      if(ledger.residualDominates)section.append(Object.assign(document.createElement('p'),{textContent:'Residual dominates individual contributions: this attribution may not identify a useful dominant input.'}));
      button.remove();
    } catch(error) {if(!controller.signal.aborted){status.textContent=error.message;button.disabled=false;}}
  };
  void supportsLedger(history.recipe).then(supported=>{if(!supported){button.disabled=true;status.textContent='Butterfly Ledger prototype is available for the default recipe only.';}});
  return ()=>{controller.abort();section.remove();};
}
