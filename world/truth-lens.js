import {provenancePresentation} from './future-machine/ui/provenance.js';

export const TRUTH_CATEGORIES = Object.freeze({
  observed: 'Observed source data; not proof of causation or present-day accuracy.',
  assumed: 'Synthetic inputs or authored assumptions; not measured facts.',
  modeled: 'Computed simulation results under declared assumptions; not predictions.',
  decorative: 'Artistic illustration; no quantitative evidence encoded.',
  unknown: 'Classification or supporting source unavailable; do not infer evidence.',
});

/** Field-level adapter; never classify an entire mixed object from one source. */
export function truthPresentation(record) {
  const raw=record?.category==='synthetic'?'assumed':record?.category;
  const source=typeof record?.source==='string'?record.source.trim():'';
  const category=Object.hasOwn(TRUTH_CATEGORIES,raw)&&source?raw:'unknown';
  const base=provenancePresentation({category:category==='assumed'?'synthetic':category,source});
  const label=category[0].toUpperCase()+category.slice(1);
  return {category,label,description:`${label}: ${source||'Source unavailable'}. ${TRUTH_CATEGORIES[category]}`,source:base.source};
}

export function markTruth(element,record) {
  const p=truthPresentation(record);
  element.dataset.truth=p.category;
  element.dataset.truthLabel=p.label;
  element.title=p.description;
  return p;
}

export function inspectedTruth({type,area,buildingId}={}) {
  const rows=[{field:'Illustration: facades, colors, interiors, vegetation and avatars',category:'decorative',source:'Authored procedural scene styling; no measured appearance or population encoded'}];
  if(type==='building') {
    const geometry=area?.buildings?.find(row=>String(row.id)===String(buildingId));
    rows.push({field:'Footprint geometry',category:geometry?(area.source==='osm'?'observed':area.source==='synthetic'?'assumed':'unknown'):'unknown',source:geometry?`${area.source||'Unknown provider'} API geometry record ${geometry.id}`:''});
    rows.push({field:'Use, dimensions and names outside API geometry',category:'unknown',source:''});
    rows.push({field:'Occupancy, stock, cash, fridge and litter',category:'modeled',source:'Legacy World current simulation state; residents are synthetic, not a census'});
  } else if(type==='person') {
    rows.push({field:'Resident identity, age, traits and assigned home/job',category:'assumed',source:'Seeded synthetic buildTown resident initialization'});
    rows.push({field:'Needs, activity, cash and relationships',category:'modeled',source:'Legacy World current resident/household/social state'});
  } else rows.push({field:'Journal narrative',category:'decorative',source:'Generated interpretation of synthetic resident activity; not testimony'});
  return rows;
}

export function mountTruthReadout(container,rows) {
  const doc=container.ownerDocument,section=doc.createElement('section');
  section.className='truth-readout';section.setAttribute('aria-label','Inspected object provenance');
  for(const row of rows){const p=doc.createElement('p');const presentation=markTruth(p,row);p.textContent=`${presentation.label} · ${row.field}. ${presentation.description}`;section.append(p);}
  container.append(section);return section;
}

export function mountTruthLens(doc) {
  const button=doc.getElementById('truthLensToggle'),legend=doc.getElementById('truthLensLegend');
  if(!button||!legend)return null;
  for(const [category,description] of Object.entries(TRUTH_CATEGORIES)){
    const item=doc.createElement('li');markTruth(item,{category,source:description});item.textContent=`${category[0].toUpperCase()+category.slice(1)} — ${description}`;legend.append(item);
  }
  let active=false;
  const set=value=>{active=value;doc.documentElement.toggleAttribute('data-truth-lens',active);button.setAttribute('aria-pressed',String(active));legend.hidden=!active;};
  const click=()=>set(!active);button.addEventListener('click',click);set(false);
  const destroy=()=>{set(false);button.removeEventListener('click',click);doc.defaultView.removeEventListener('pagehide',destroy);};
  doc.defaultView.addEventListener('pagehide',destroy,{once:true});
  return {destroy,getState:()=>({active})};
}

if(typeof document!=='undefined')mountTruthLens(document);
