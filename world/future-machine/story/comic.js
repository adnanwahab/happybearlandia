/** Static presentation of the same pinned City history. Never runs the model. */
import {calendarLabel, METRIC_UNITS} from '../contracts.js';
import {validateRecipe} from '../data/index.js';
import {createShareURL} from '../share/index.js';

const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const METRIC_LABELS = {housingUnits:'Homes',meanRent:'Mean unit rent',capitalSpending:'Cumulative capital spending'};
const LIMITS = 'Synthetic model illustration, not a historical photograph or prediction. Schematic inventory; no real parcel locations. Dates are illustrative. Mean unit rent includes new inventory and vacancies, not matched household savings. Detailed states are recomputed from the saved City manifest, not independently verified checkpoints.';
const STYLE = '.fm-comic{padding:16px;overflow-wrap:anywhere;color:#182d3b;background:#fff}.fm-comic-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:12px}.fm-comic article{border:2px solid #27475c;border-radius:8px;padding:12px;break-inside:avoid}.fm-comic svg{width:100%;height:auto}.fm-comic pre{white-space:pre-wrap;font-size:12px}.fm-comic button,.fm-comic a{min-height:44px;display:inline-flex;align-items:center;margin:4px}.fm-comic summary{cursor:pointer;padding:8px}@media print{body.fm-comic-print>*:not(.fm-comic){display:none!important}.fm-comic{display:block!important}.fm-comic button{display:none}.fm-comic details>*{display:block}.fm-comic-grid{display:block}.fm-comic article{margin:10px 0}}';

export function buildComic(history, {baseURL='http://localhost/world/future-machine.html'}={}) {
  try {
    if(!history?.experimentId || !history.initialHash || !history.provenance || history.modelVersion!==history.recipe?.modelVersion || history.seed!==history.recipe?.seed)throw Error('Pinned run identity or provenance unavailable');
    validateRecipe(history.recipe);
    const months=new Set([0,24,60,96,120]);
    // Only an explicit producer completion record earns an event checkpoint.
    const complete=history.plan?.find(s=>s?.events?.some(e=>e.eventType==='PROJECT_COMPLETE'));
    if(complete && Number.isInteger(complete.month) && complete.month>=0 && complete.month<=120)months.add(complete.month);
    const panels=[...months].sort((a,b)=>a-b).slice(0,6).map(month=>{
      const arms=['baseline','plan'].map(arm=>{
        const snapshot=history[arm]?.[month];
        if(!snapshot || snapshot.month!==month || !Array.isArray(snapshot.state?.buildings))return {arm,missing:true};
        return {arm,missing:false,buildings:snapshot.state.buildings.map(b=>({id:b.id,floors:Number.isFinite(b.floors)?b.floors:null})),metrics:Object.fromEntries(['housingUnits','meanRent','capitalSpending'].map(k=>[k,Number.isFinite(snapshot.metrics?.[k])?snapshot.metrics[k]:null])),events:Array.isArray(snapshot.events)?snapshot.events:null};
      });
      return {month,date:calendarLabel(month),arms,url:createShareURL({recipe:history.recipe,experimentId:history.experimentId,month,landing:undefined},baseURL)};
    });
    return {version:'comic-city.v1',available:true,limits:LIMITS,identity:{experimentId:history.experimentId,modelVersion:history.modelVersion,seed:history.seed,initialHash:history.initialHash,recipe:history.recipe,provenance:history.provenance},panels};
  } catch(error) {return {version:'comic-city.v1',available:false,reason:error.message,limits:LIMITS,panels:[]};}
}

function armMarkup(arm) {
  if(arm.missing)return `<p>${arm.arm}: Missing frame — inventory, metrics and events unavailable.</p>`;
  const metrics=Object.entries(arm.metrics).map(([key,value])=>`${METRIC_LABELS[key]}: ${value===null?'unavailable':value} ${METRIC_UNITS[key]}`).join('; ');
  // Bound drawing cost; list every source identity in the text alternative.
  const blocks=arm.buildings.slice(0,24).map((b,i)=>{const h=Math.max(12,Math.min(64,(b.floors??1)*12));return `<rect x="${8+(i%12)*25}" y="${12+Math.floor(i/12)*80+64-h}" width="18" height="${h}" fill="${arm.arm==='plan'?'#b86a30':'#326f90'}" stroke="#182d3b"/>`;}).join('');
  return `<h4>${arm.arm}</h4><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 170" role="img" aria-label="${escape(arm.arm)} schematic inventory: ${arm.buildings.length} buildings; first 24 drawn. Heights illustrate recorded floors, clamped for display; unknown floors use a placeholder."><title>Synthetic City inventory illustration</title>${blocks}</svg><p>${escape(metrics)}</p>${arm.events===null?'<p>Event records unavailable.</p>':''}<details><summary>Complete text alternative and source records</summary><p>${arm.buildings.length} recorded buildings. First 24 drawn; schematic slots are not map locations.</p><pre>${escape(JSON.stringify({buildings:arm.buildings,events:arm.events},null,2))}</pre></details>`;
}
export function comicMarkup(comic) {
  return `<section class="fm-comic" aria-label="Comic strip future recap"><h2>Comic strip future recap</h2><p>${escape(comic.limits)}</p>${!comic.available?`<p role="status">Recap unavailable: ${escape(comic.reason)}</p>`:`<p>Private local preview. Download only if you have rights to the included run data. No upload or automatic sharing. Delete downloaded files using your device's file controls.</p><details><summary>Pinned inputs and source provenance</summary><pre>${escape(JSON.stringify(comic.identity,null,2))}</pre></details><div class="fm-comic-grid">${comic.panels.map(p=>`<article><h3>${p.date} · Month ${p.month}</h3><p>${p.month===0?'Our shared starting city, before the proposal.':p.arms.some(a=>a.events?.some(e=>e.eventType==='PROJECT_COMPLETE'))?'The model records a completed project. Compare both inventories below.':'The two modeled futures at this checkpoint.'}</p>${p.arms.map(armMarkup).join('')}<a href="${escape(p.url)}">Open this checkpoint · ${p.date}</a></article>`).join('')}</div>`}</section>`;
}
export function comicDocument(comic) {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Comic strip future recap</title><style>${STYLE}</style><body class="fm-comic-print">${comicMarkup(comic).replaceAll('<details>','<details open>')}</body></html>`;
}
export function mountComic(container,{getHistory=()=>null,baseURL='http://localhost/world/future-machine.html'}={}) {
  const doc=container.ownerDocument,host=doc.createElement('section');host.className='fm-comic';
  const heading=doc.createElement('h2');heading.textContent='Remember this future';
  const open=doc.createElement('button');open.type='button';open.textContent='Create comic strip recap';
  const output=doc.createElement('div');host.append(heading,open,output);container.append(host);
  let current=null;
  const onOpen=()=>{current=buildComic(getHistory(),{baseURL});output.innerHTML=`<style>${STYLE}</style>${comicMarkup(current)}`;
    if(!current.available)return;
    const download=doc.createElement('button');download.type='button';download.textContent='Download printable recap';
    download.onclick=()=>{const url=URL.createObjectURL(new Blob([comicDocument(current)],{type:'text/html'}));const a=doc.createElement('a');a.href=url;a.download='future-comic.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
    const notice=doc.createElement('p');notice.textContent='Open the downloaded HTML file and use your browser Print command. All panels, links, text alternatives and provenance are included.';
    output.prepend(download,notice);
  };
  open.addEventListener('click',onOpen);
  return {clear(){current=null;output.replaceChildren();},dispose(){open.removeEventListener('click',onOpen);host.remove();}};
}
