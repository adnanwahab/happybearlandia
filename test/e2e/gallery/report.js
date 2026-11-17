import {inventory,paths} from './inventory.js';

export function evidenceStatus({status,expectedStatus,observation,screenshot,currentSource}){
  if(status==='skipped')return 'skipped';
  if(status!=='passed'||expectedStatus!=='passed')return 'failed';
  if(!observation||!screenshot)return 'missing-evidence';
  if(observation.source?.revision!==currentSource.revision||
    observation.source?.fingerprint!==currentSource.fingerprint)return 'stale-evidence';
  return 'checks-passed';
}
export function buildReport(tests,source,runStatus){
  const selected=paths.map(path=>({...path,tests:tests.filter(t=>t.file===path.file)}));
  const missingPaths=selected.filter(p=>new Set(p.tests.map(t=>t.id)).size!==p.expectedTests).map(p=>p.rank);
  return {version:1,source,runStatus,featureAcceptance:'unverified',
    limitations:['Checks-passed applies only to named assertions in this checkout.',
      'Proposed/unmapped features are never inferred implemented from a route, PR or exit code.',
      'Missing, skipped, stale and expected-failure tests cannot satisfy evidence.',
      'Mobile, keyboard, reduced motion, rights/deletion and denial coverage remain path-specific.'],
    inventory:inventory.map(row=>({...row,receipts:selected.filter(p=>p.feature===row.id).map(p=>({
      rank:p.rank,tests:p.tests.map(t=>t.id)}))})),paths:selected,missingPaths,tests};
}
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderGallery(report){
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
  <title>HBL-FUN-101–200 regression evidence</title>
  <style>body{font:16px system-ui;max-width:1100px;margin:2em auto;padding:1em;background:#faf8f1;color:#222}
  table{border-collapse:collapse;width:100%}td,th{padding:.6em;border:1px solid #aaa;text-align:left;overflow-wrap:anywhere}
  img{max-width:100%;height:auto}details{padding:.7em;border:1px solid #aaa;margin:.5em 0}a{color:#163f80}</style>
  <h1>Hundred-feature regression inventory</h1><p>Feature acceptance: <strong>unverified</strong>.
  Run: ${escape(report.runStatus)}. Source: ${escape(report.source.revision)} / ${escape(report.source.fingerprint)}.</p>
  <p>Supporting checks are not feature completion. Screenshots are observations, not approved visual baselines.
  Unmapped routes and missing receipts remain explicit. Local artifacts only; do not publish user screenshots.</p>
  <p>Missing selected paths: ${escape(report.missingPaths.join(', ')||'none')}.</p>
  <pre>${escape((report.errors??[]).join('\n'))}</pre>
  <table><thead><tr><th>Feature</th><th>Implementation audit</th><th>Representative route/state</th><th>Keyboard</th><th>Evidence</th></tr></thead><tbody>
  ${report.inventory.map(r=>`<tr><td>${escape(r.id)}<br>${escape(r.title)}</td><td>${escape(r.implementation)}</td>
    <td>${escape(r.route??'Unmapped')}<br>${escape(r.state)}</td><td>${escape(r.keyboard)}</td>
    <td>${r.receipts.length?r.receipts.map(p=>`<a href="#path-${p.rank}">Path ${p.rank}</a>`).join(' '):'Missing receipt / screenshot'}</td></tr>`).join('')}
  </tbody></table><h2>Twenty prioritized paths</h2>
  ${report.paths.map(p=>`<section id="path-${p.rank}"><h3>${p.rank}. ${escape(p.file)}</h3>
    <p>${escape(p.scope)} · ${escape(p.state)}. ${escape(p.limitation)}</p>
    ${p.tests.length?p.tests.map(t=>`<details><summary>${escape(t.status)}: ${escape(t.title)}</summary>
      <p>Attempt ${t.retry}; actual result ${escape(t.actualStatus)}.</p>
      <p>${(t.artifacts??[]).map(a=>`<a href="${escape(a.url)}">${escape(a.name)}</a> (SHA-256 ${escape(a.sha256)})`).join('<br>')}</p>
      <pre>${escape(JSON.stringify({errors:t.errors,browserErrors:t.browserErrors},null,2))}</pre>
      ${t.screenshot?`<img loading="lazy" alt="Final observed state for ${escape(t.title)}" src="${escape(t.screenshot.url)}"><p>SHA-256 ${escape(t.screenshot.sha256)}</p>`:'<p>No screenshot evidence.</p>'}
      <pre>${escape(JSON.stringify(t.observation??{evidence:'missing'},null,2))}</pre></details>`).join(''):'<p>Not executed: missing evidence.</p>'}</section>`).join('')}</html>`;
}
