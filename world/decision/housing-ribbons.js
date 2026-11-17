// Read-only annual adapter. Household-to-home equivalence is a display assumption.
const valid = n => typeof n === 'number' && Number.isFinite(n) && n >= 0;
export function housingRibbonData(experiment, run) {
  if (experiment?.modelId !== 'housing.v1' || run?.modelVersion !== '1.2.0') return { rows: [], crossings: [] };
  const ledger = run.events || [];
  const rows = (run.timeline || []).filter(r => Number.isInteger(r.year) && r.year > 0 && run.timeline.filter(t => t.year === r.year).length === 1).map(r => {
    const matches = ledger.filter(e => e.type === 'annual-accounting' && e.month === r.year * 12 && e.year === r.year);
    const e = matches.length === 1 ? matches[0] : null;
    const supply = r.metrics?.housing_supply;
    return { year: r.year, month: r.year * 12, supply: valid(supply) ? supply : null,
      demand: valid(e?.households) ? e.households : null,
      supplyKey: `timeline[${run.timeline.indexOf(r)}].metrics.housing_supply`,
      demandKey: e ? `events[${ledger.indexOf(e)}].households` : 'unavailable' };
  }).sort((a,b) => a.year-b.year);
  const crossings = [];
  for (let i=0;i<rows.length;i++) {
    const a=rows[i], b=rows[i+1];
    if (a.supply === null || a.demand === null) continue;
    const delta=a.supply-a.demand;
    if (delta===0) crossings.push({ from:a, to:a, year:a.year });
    else if (b && b.year===a.year+1 && b.supply!==null && b.demand!==null && delta*(b.supply-b.demand)<0)
      crossings.push({ from:a, to:b, year:a.year+delta/(delta-(b.supply-b.demand)) });
  }
  return { rows, crossings };
}
export function renderHousingRibbons(host, experiment, run, receiptURL) {
  host.replaceChildren();
  const doc=host.ownerDocument;
  const add=(tag,text,parent=host)=>{const n=doc.createElement(tag);n.textContent=text;parent.append(n);return n};
  add('h3','Housing demand and supply ribbons');
  add('p','Computed synthetic model results. Demand uses one home per modeled household; no observed demand series. Ribbon width and depth are decorative. Crossings are chart coordinates, never geographic places or causal claims.');
  const {rows,crossings}=housingRibbonData(experiment,run);
  if (!rows.length || !receiptURL) { add('p','Unavailable: select a compatible completed housing 1.2.0 run with annual snapshots.'); return; }
  add('p',`Experiment ${experiment.id} · Run ${run.id} · Scenario ${run.scenarioId} · Seed ${run.seed} · Model ${run.modelVersion} · Rules ${run.engineVersion}`);
  const link=add('a','Inspect exact run JSON');link.href=receiptURL;
  const chart=doc.createElementNS('http://www.w3.org/2000/svg','svg');chart.setAttribute('viewBox','0 0 760 300');chart.setAttribute('role','img');chart.setAttribute('aria-label','Projected 3D ribbons: housing supply teal and household demand orange. Annual values and units follow in table.');chart.style.width='100%';host.append(chart);
  const values=rows.flatMap(r=>[r.supply,r.demand]).filter(valid),max=Math.max(1,...values),last=Math.max(1,...rows.map(r=>r.year));
  for (const [x,y,text] of [[10,260,'0'],[10,35,String(Math.round(max))],[55,285,'Year 0'],[620,285,`Year ${last}`]]) {
    const label=doc.createElementNS(chart.namespaceURI,'text');label.setAttribute('x',String(x));label.setAttribute('y',String(y));label.setAttribute('fill','currentColor');label.textContent=text;chart.append(label);
  }
  const project=(r,key,z)=>[55+r.year/last*610+z,245-r[key]/max*200-z*.45];
  for (const [key,color] of [['supply','#087f7e'],['demand','#b96928']]) for(let i=0;i<rows.length-1;i++) {
    const a=rows[i],b=rows[i+1];if(a[key]===null||b[key]===null||b.year!==a.year+1)continue;
    const polygon=doc.createElementNS(chart.namespaceURI,'polygon');polygon.setAttribute('points',[project(a,key,-12),project(b,key,-12),project(b,key,12),project(a,key,12)].map(p=>p.join(',')).join(' '));polygon.setAttribute('fill',color);polygon.setAttribute('fill-opacity','.7');chart.append(polygon);
  }
  add('p','Teal: housing_supply (homes). Orange: annual-accounting.households × 1 home/household (home equivalents). Horizontal axis: modeled year; vertical axis: homes / home equivalents, common zero baseline.');
  const table=add('table','');table.className='dv-table';table.style.width='100%';table.style.tableLayout='fixed';table.style.overflowWrap='anywhere';
  const header=add('tr','',add('thead','',table));for(const s of ['Year / month','Supply · homes','Demand · home equivalents','Exact source keys'])add('th',s,header);
  const body=add('tbody','',table);
  for(const r of rows){const tr=add('tr','',body);for(const v of [`${r.year} / ${r.month}`,r.supply??'unavailable',r.demand??'unavailable',`${r.supplyKey}; ${r.demandKey}`])add('td',String(v),tr);}
  const status=add('p','Select a crossing to inspect its bounding observations.');status.setAttribute('role','status');
  if(!crossings.length)status.textContent='No supported crossing in available adjacent annual observations. Missing data stays missing; no gap is bridged.';
  for(const c of crossings){const button=add('button',`Inspect crossing near modeled year ${c.year.toFixed(2)}`);button.type='button';button.onclick=()=>{status.textContent=`${c.from===c.to?'Exact equality':'Linear interpolation, not a recorded event'} · modeled years ${c.from.year}–${c.to.year}, months ${c.from.month}–${c.to.month} · housing_supply in homes vs households × 1 home/household in home equivalents · ${[c.from,c.to].map(r=>`${r.supplyKey}=${r.supply}; ${r.demandKey}=${r.demand}`).join(' → ')} · run ${run.id}`;};}
}
