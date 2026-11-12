const $ = id => document.getElementById(id);
function node(tag, text, parent, className) {
  const element = document.createElement(tag);
  if (text != null) element.textContent = text;
  if (className) element.className = className;
  parent.append(element);
  return element;
}
function link(parent, text, href) {
  const a = node('a', text, parent); a.href = href;
}
const display = value => value == null ? 'Unavailable' : String(value);
const usd = value => value == null ? 'Unavailable' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
function card(parent, title, panel) {
  const article = node('article', null, parent);
  node('h3', title, article);
  node('p', `${panel.available ? panel.freshness : 'unavailable'} · ${panel.observedAt || 'No observation'}`, article, 'state');
  link(article, 'Source issue or run ↗', panel.source);
  return article;
}
function list(parent, rows, describe) {
  if (!rows?.length) { node('p', 'No records supplied. This does not establish a passing result.', parent); return; }
  const ul = node('ul', null, parent);
  for (const row of rows) { const li = node('li', null, ul); link(li, describe(row), row.source); }
}
function render(report, health) {
  $('engineering').replaceChildren(); $('product').replaceChildren();
  let panel = card($('engineering'), 'Linear queue & held tasks', report.queue);
  node('p', `${display(report.queue.total)} scanned · ${display(report.queue.eligible)} eligible · ${display(report.queue.held)} held`, panel, 'metric');
  node('p', 'Holds include readiness, ownership and approval requirements; they are not all Linear dependency blocks.', panel);
  list(panel, report.queue.tasks, row => `${row.id} — ${row.reasons.join('; ')}`);
  panel = card($('engineering'), 'Symphony agents', report.symphony);
  for (const key of ['running', 'retrying', 'blocked', 'capacity']) node('p', `${key}: ${display(report.symphony[key])}`, panel);
  panel = card($('engineering'), 'CI failures & runs', report.ci);
  node('p', `${report.ci.runs.filter(run => run.status === 'failure').length} failures in supplied inventory`, panel, 'metric');
  if (!report.ci.available) panel.querySelector('.metric').textContent = 'CI inventory unavailable';
  list(panel, report.ci.runs, run => `${run.status} — ${run.name}`);
  panel = card($('engineering'), 'Cost per verified feature', report.costs);
  node('p', `${usd(report.costs.perFeatureUSD)} / verified feature`, panel, 'metric');
  node('p', `${usd(report.costs.totalUSD)} across ${display(report.costs.verifiedFeatures)} verified features. USD; all attempts for each supplied feature in the observation window. This is not a measure of fun.`, panel);
  list(panel, report.costs.features, feature => `${feature.id} — ${usd(feature.costUSD)}`);
  panel = card($('engineering'), 'Release readiness', report.release);
  const matches = health && health.buildId !== 'unknown' && health.buildId !== 'development' && health.buildId === report.release.buildId;
  const gatesPass = report.release.gates.length > 0 && report.release.gates.every(g => g.status === 'passed');
  const ready = health?.status === 'ready' && matches && report.release.freshness === 'fresh' && gatesPass;
  node('p', ready ? 'Recorded gates passed for this build' : 'Release not established', panel, 'metric');
  node('p', `Local storage probe: ${health?.status || 'unavailable'} · build ${health?.buildId || 'unavailable'}. Evidence build: ${report.release.buildId || 'unavailable'}. Storage health alone does not establish release readiness.`, panel);
  link(panel, 'Local readiness response', '/api/ready');
  list(panel, report.release.gates, gate => `${gate.status} — ${gate.name}`);
  panel = card($('product'), 'Player outcomes & enjoyment', report.product);
  list(panel, report.product.outcomes, outcome => `${outcome.name}: ${outcome.value} ${outcome.unit} (${outcome.kind})`);
}
async function refresh() {
  $('refresh').disabled = true; $('status').textContent = 'Loading evidence…';
  // Clear prior observations so a failed refresh cannot leave a healthy-looking result.
  $('engineering').replaceChildren(); $('product').replaceChildren();
  const read = async path => { const response = await fetch(path, { cache: 'no-store', signal: AbortSignal.timeout(10000) }); if (!response.ok) throw new Error('Unavailable'); return response.json(); };
  try {
    const [report, health] = await Promise.all([read('/api/operations-observatory'), read('/api/ready').catch(() => null)]);
    render(report, health);
    $('status').textContent = `Evidence refreshed ${report.generatedAt}. Freshness is evaluated per source.`;
  } catch { $('status').textContent = 'Evidence unavailable. Retry refresh to load current observations.'; }
  finally { $('refresh').disabled = false; }
}
$('refresh').addEventListener('click', refresh);
refresh();

// Keep source-age labels current in a long-running operations tab.
setInterval(() => { if (!document.hidden && !$('refresh').disabled) refresh(); }, 60000);
