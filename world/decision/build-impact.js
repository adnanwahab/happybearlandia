/** Input estimates only. Never run the model or infer spending from a proposal.
 * Cancelled/proposed projects are inert in buildings/lifecycle.js.
 */
export function summarizeBuildImpact(scenario) {
  const active = (scenario?.projects || []).filter(p => !['cancelled', 'proposed'].includes(p.status));
  const sum = key => active.reduce((total, p) => total + p.finance[key], 0);
  return { projects: active.length, estimatedCost: sum('estimatedCost'), publicSubsidy: sum('publicSubsidy') };
}

export function buildImpactLines(before, after) {
  if (!after) return ['Pending estimates unavailable until this proposal validates.'];
  const current = summarizeBuildImpact(before), pending = summarizeBuildImpact(after);
  const usd = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  const lines = [
    'Synthetic input estimates · not recorded spending or run outcomes.',
    `Committed project estimates: ${usd(current.estimatedCost)} total · ${usd(current.publicSubsidy)} public subsidy.`,
    `Pending project estimates after approval: ${usd(pending.estimatedCost)} total · ${usd(pending.publicSubsidy)} public subsidy.`,
    `Estimated change: ${usd(pending.estimatedCost - current.estimatedCost)} total · ${usd(pending.publicSubsidy - current.publicSubsidy)} public subsidy.`,
    'Remaining budget unavailable: this workspace has no project budget ceiling. Approval saves assumptions; it does not charge money.',
  ];
  for (const p of after.projects || []) {
    if (['cancelled', 'proposed'].includes(p.status)) continue;
    if (JSON.stringify(p) === JSON.stringify(before?.projects?.find(row => row.id === p.id))) continue;
    lines.push(`${p.name} · ${p.program.residentialUnits} planned homes · permit ${p.construction.permitMonths} months + build ${p.construction.buildMonths} months (minimum 8 build months in the model). Delays, shared capacity, cancellation and cost overruns can change delivery; occupancy and actual spending require a simulation.`);
  }
  lines.push('Removing or cancelling a project edits the next experiment input; it does not refund recorded spending or undo an existing run.');
  return lines;
}
