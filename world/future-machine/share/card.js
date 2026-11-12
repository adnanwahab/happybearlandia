import {createEvidenceReport} from './index.js';
import {compareFrame} from '../diff/index.js';
import {calendarLabel, METRIC_UNITS} from '../contracts.js';

const METRICS = [['housingUnits','Housing'],['meanRent','Whole-stock mean rent'],['meanTravelMinutes','Link travel time'],['capitalSpending','Capital spending']];
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
/** A detached presentation of selected recorded observations, never a new simulation. */
export function createShareCard(history, month) {
  const evidence=createEvidenceReport(history,{month});
  const baseline=history.baseline[month], plan=history.plan[month];
  for(const snapshot of [baseline,plan]) if(snapshot.state?.seed!==history.seed || snapshot.state?.version!==history.modelVersion) throw new Error('Share card requires matched recorded seed and model');
  const diff=compareFrame({month,baseline,plan});
  const rows=METRICS.map(([key,label])=>({key,label,unit:METRIC_UNITS[key],baseline:diff.metrics[key].baseline,plan:diff.metrics[key].plan,delta:diff.metrics[key].delta}));
  return {month,date:calendarLabel(month),seed:evidence.seed,modelVersion:evidence.modelVersion,experimentId:evidence.experimentId,initialHash:evidence.initialHash,recipe:evidence.recipe,rows,
    comparison:rows.some(row=>row.delta===null)?'Some measurements unavailable':rows.every(row=>row.delta===0)?'No change in displayed measurements':'Modeled differences in displayed measurements',
    provenance:'Recorded monthly snapshots · manifest recomputation · future-machine-synthetic.v1',
    fallback:history.provenance?.shareFallback?'Saved record unavailable; recomputed from recipe.':null};
}
/** Self-contained image: no external fonts, assets, markup or narrative claims. */
export function shareCardSVG(card) {
  const text=(x,y,value,size=20)=>`<text x="${x}" y="${y}" font-size="${size}">${escape(value)}</text>`;
  const value=v=>v===null?'Unavailable':String(v);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900"><rect width="1200" height="900" fill="#101e2a"/><g fill="#eff6fa" font-family="Arial, sans-serif">${text(48,64,'One City, Two Futures',36)}${text(48,104,`Month ${card.month} · ${card.date} · seed ${card.seed}`)}${text(48,140,`Model ${card.modelVersion} · run ${card.experimentId??'unavailable'}`,16)}${text(48,176,card.provenance,16)}${text(450,230,'WITHOUT PLAN',22)}${text(810,230,'WITH PLAN',22)}${card.rows.map((row,i)=>{const y=285+i*100;return text(48,y,row.label)+text(48,y+28,row.unit,16)+text(450,y,value(row.baseline),18)+text(810,y,value(row.plan),18)+text(810,y+28,`Delta: ${value(row.delta)}`,16);}).join('')}${text(48,680,card.comparison,22)}${text(48,718,'Synthetic data · illustrative, uncalibrated City rules · not an empirical forecast.',20)}${text(48,752,'One matched seed is not an uncertainty distribution. Link time is not resident commute.',18)}${text(48,786,card.fallback??'Replay equivalence to independently retained checkpoints has not been verified.',16)}${text(48,810,'Whole-stock rent includes added inventory; it is not matched incumbent rent.',16)}${text(48,836,`Input digest: ${card.initialHash}`,14)}${text(48,860,card.recipe.intervention?`Plan: ${card.recipe.intervention.type} · ${card.recipe.intervention.districtId} · amount ${card.recipe.intervention.amount} · cost ${card.recipe.intervention.cost} USD`:'Plan: none (matched control)',16)}</g></svg>`;
}
export async function downloadShareCard(history, month) {
  // Capture before asynchronous image decoding, so scrubbing cannot mix months.
  const card=createShareCard(history,month), svg=shareCardSVG(card);
  const source=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
  let pngURL;
  try {
    const image=new Image();image.src=source;await image.decode();
    const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=900;
    const context=canvas.getContext('2d');if(!context)throw new Error('Image export unavailable');
    context.drawImage(image,0,0);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('Image export unavailable');
    pngURL=URL.createObjectURL(blob);const link=document.createElement('a');link.href=pngURL;link.download=`future-machine-seed-${card.seed}-month-${card.month}.png`;link.click();
  } finally {URL.revokeObjectURL(source);if(pngURL)setTimeout(()=>URL.revokeObjectURL(pngURL),1000);}
}
