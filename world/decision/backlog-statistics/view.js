const escape = x => String(x??'Unavailable').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finite = x => typeof x==='number'&&Number.isFinite(x);
/** Dedicated plot for executed numerical PDP output, never descriptive bins.
 * Gaps remain gaps. Percentiles are spread across retained rows, not CI. */
export function partialDependenceChart(result,{parameterLabel=result?.parameterId,metricLabel=result?.metricId,inputUnit='',outputUnit=''}={}) {
  const points=result?.points||[];
  const valid=points.filter(p=>finite(p.value)&&finite(p.mean)&&p.count>0);
  if(!valid.length) return '<p>No finite numerical partial-dependence evaluations available.</p>';
  const xs=valid.map(p=>p.value),ys=valid.map(p=>p.mean),xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);
  const x=v=>60+(xmax===xmin?0.5:(v-xmin)/(xmax-xmin))*580,y=v=>235-(ymax===ymin?0.5:(v-ymin)/(ymax-ymin))*195;
  let previous=null;const shapes=[];
  for(const p of points) {
    if(!finite(p.value)||!finite(p.mean)||!(p.count>0)){previous=null;continue;}
    if(previous) shapes.push(`<line x1="${x(previous.value)}" y1="${y(previous.mean)}" x2="${x(p.value)}" y2="${y(p.mean)}" stroke="currentColor"/>`);
    shapes.push(`<circle cx="${x(p.value)}" cy="${y(p.mean)}" r="4" fill="currentColor"><title>${escape(p.value)} ${escape(inputUnit)}: ${escape(p.mean)} ${escape(outputUnit)}, n=${escape(p.count)}</title></circle>`);previous=p;
  }
  return `<figure><svg data-statistics-pdp viewBox="0 0 700 290" style="width:100%;max-width:900px" role="img" aria-label="Executed numerical partial dependence: mean ${escape(metricLabel)} by ${escape(parameterLabel)}"><title>Numerical PDP mean response</title><path d="M60 30V235H650" fill="none" stroke="currentColor"/>${shapes.join('')}<text x="60" y="255">${escape(xmin)}</text><text x="600" y="255">${escape(xmax)}</text><text x="5" y="40">${escape(ymax)}</text><text x="5" y="235">${escape(ymin)}</text><text x="160" y="280">${escape(parameterLabel)} (${escape(inputUnit)})</text></svg><figcaption>${escape(metricLabel)} (${escape(outputUnit)}). Mean over matched retained rows; connecting segments guide the eye. Missing evaluations break the curve. P10–P90 in the table are model spread, not confidence intervals.</figcaption><table><thead><tr><th>Input</th><th>Executed rows</th><th>Mean</th><th>P10</th><th>P90</th></tr></thead><tbody>${points.map(p=>`<tr><td>${escape(p.value)}</td><td>${escape(p.count)}</td><td>${escape(p.mean)}</td><td>${escape(p.p10)}</td><td>${escape(p.p90)}</td></tr>`).join('')}</tbody></table>${result.reconstructionAudits?`<details><summary>Source reconstruction arithmetic audit</summary><pre>${escape(JSON.stringify({years:result.years,audits:result.reconstructionAudits},null,2))}</pre></details>`:''}</figure>`;
}
export function factorialReport(result) {
  if(!result) return '<p>No balanced design executed.</p>';
  const failed=result.evaluations.filter(e=>e.status!=='completed');
  const unavailableReason=result.status==='numerical-failure'?'arithmetic or variance reconstruction failed.':result.status==='cancelled'?'design cancelled before publication.':'every crossed cell and seed must complete.';
  return `<section data-statistics-report><h4>Balanced design variance</h4><p>${escape(result.method||result.status)} · ${result.evaluations.length}/${result.design.evaluations} evaluations; ${failed.length} failed.</p>${result.available?`<p data-statistics-total data-value="${escape(result.totalVariance)}">Total variance: ${escape(result.totalVariance)} (${escape(result.provenance?.unit||'outcome')} squared). ${escape(result.limitations)}</p><table><thead><tr><th>Component</th><th>Variance</th><th>Share</th></tr></thead><tbody>${result.components.map(c=>`<tr data-statistics-component="${escape(c.factors.join(','))}"><td>${c.factors.map(escape).join(' × ')}</td><td data-statistics-variance data-value="${escape(c.variance)}">${escape(c.variance)}</td><td>${c.share===null?'Undefined: zero variance':escape(c.share)}</td></tr>`).join('')}</tbody></table>`:`<p>Decomposition unavailable: ${unavailableReason}</p>`}<details><summary>Exact execution manifest</summary><pre data-statistics-manifest>${escape(JSON.stringify({design:result.design,provenance:result.provenance,reconstruction:result.reconstruction},null,2))}</pre></details>${failed.map(e=>`<p>Cell ${e.cell}, seed ${e.seed}: ${escape(e.error)}</p>`).join('')}</section>`;
}
