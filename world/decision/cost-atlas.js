// Read-only projection of the housing v1.2 ledger. No incidence inference.
const nonnegative = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
export function householdCostAtlas(experiment, run) {
  const missing = { status: 'unavailable', bins: [], burden: null, count: null, eligibleCount: null };
  if (!run || experiment?.modelId !== 'housing.v1' || run.modelVersion !== '1.2.0') return missing;
  const burden = run.metrics?.low_income_rent_burden;
  const bins = [
    ['Construction grants', 'subsidySpent'], ['Rental assistance', 'voucherSpent'], ['Public projects', 'projectPublicSpent'],
  ].map(([label, key]) => ({ label, value: run.accounting?.[key], path: `accounting.${key}` }));
  const total = run.metrics?.public_expenditure;
  const valid = bins.every(bin => nonnegative(bin.value)) && nonnegative(total);
  const sum = valid ? bins.reduce((value, bin) => value + bin.value, 0) : null;
  const reconciled = valid && Number.isFinite(sum) && Math.abs(sum - total) <= Math.max(0.01, total * 1e-10);
  return { ...missing, status: reconciled ? 'supported' : 'unavailable', bins: reconciled ? bins : [],
    total: nonnegative(total) ? total : null, burden: nonnegative(burden) ? burden : null };
}

export function renderHouseholdCostAtlas(host, experiment, run, receiptURL) {
  const doc = host.ownerDocument;
  host.replaceChildren();
  const add = (tag, text) => { const node = doc.createElement(tag); node.textContent = text; host.append(node); return node; };
  add('h3', 'Household Cost Atlas');
  if (!run || !receiptURL) { add('p', 'Select a completed future to inspect supported costs.'); return; }
  const atlas = householdCostAtlas(experiment, run);
  if (experiment?.modelId !== 'housing.v1' || run.modelVersion !== '1.2.0') {
    add('p', 'Cost atlas unavailable for this model version. No compatible allocation contract.');
    const source = add('a', 'Open exact aggregate source (run JSON)'); source.href = receiptURL; return;
  }
  add('p', `Final horizon · Experiment ${experiment.id} · Run ${run.id} · Scenario ${run.scenarioId} · Seed ${run.seed} · Model ${run.modelVersion} · Rules ${run.engineVersion}`);
  add('p', 'Computed synthetic model results, not observed household bills. Who pays: unavailable. Taxpayer, landlord and household incidence is not allocated by this model.');
  add('p', `Low-income net rent burden: ${atlas.burden === null ? 'unavailable' : `${atlas.burden.toFixed(2)}% of modeled annual income`}. Cohort count: unavailable. Eligible count: unavailable (not retained in this run).`);
  add('p', 'Synthetic assumptions: a 25% low-income eligibility share and income at 55% of the median, adjusted for unemployment. These assumptions do not establish observed population counts. No household identities are mapped.');
  const money = value => `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })} USD`;
  if (atlas.status === 'supported') {
    add('h4', 'Public spending by use — not household incidence');
    const list = add('ul', '');
    for (const bin of atlas.bins) {
      const item = doc.createElement('li'), link = doc.createElement('a');
      link.textContent = `${bin.label}: ${money(bin.value)} · source ${bin.path}`;
      link.href = receiptURL; item.append(link); list.append(item);
    }
    add('p', `Supported total: ${money(atlas.total)}. All three ledger categories included; no ledger exclusions. Financing incidence, private costs and household bills are excluded because they are unsupported. Display rounding may differ by a cent.`);
  } else add('p', 'Spending bins unavailable: missing or inconsistent allocation ledger. No residual or equal-share allocation is invented.');
  const source = add('a', 'Open exact aggregate source (run JSON)'); source.href = receiptURL;
  add('p', 'Source fields: metrics.low_income_rent_burden, metrics.public_expenditure and accounting. This panel always shows final-horizon values; the replay slider does not change its time. No decorative data layers.');
}
