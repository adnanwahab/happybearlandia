import { housingProjectBuildingId } from '../city/contracts.js';
import { cityMetrics } from '../city/engine.js';

/** Exact all-unit shift-share identity; never an estimate of household savings. */
export function decomposeRent(frame) {
  const a = frame?.baseline, b = frame?.plan;
  const unavailable = reason => ({status:'unavailable', reason});
  if (!a?.state || !b?.state || a.state.month !== b.state.month || a.state.seed !== b.state.seed || a.state.version !== b.state.version || !Array.isArray(a.state.units) || !Array.isArray(b.state.units)) return unavailable('Matched monthly unit snapshots are required.');
  const baseline = a.state.units, plan = b.state.units;
  if (![...baseline, ...plan].every(u => Number.isFinite(u.rent))) return unavailable('Unit rents are missing or nonfinite.');
  const baselineIds = new Set(baseline.map(u => u.id));
  const buildings = new Set((b.state.projects || []).filter(p => p.type === 'housing').map(p => housingProjectBuildingId(p.id)));
  const added = plan.filter(u => !baselineIds.has(u.id) && buildings.has(u.buildingId));
  const existing = plan.filter(u => baselineIds.has(u.id));
  if (!baseline.length || !existing.length || existing.length !== baseline.length || existing.length + added.length !== plan.length || new Set(plan.map(u => u.id)).size !== plan.length || baselineIds.size !== baseline.length) return unavailable('The existing stock must match baseline units; all added units need a recorded housing project.');
  const mean = units => units.reduce((sum,u) => sum + u.rent, 0) / units.length;
  const baselineMean = cityMetrics(a.state).meanRent, planMean = cityMetrics(b.state).meanRent;
  const existingMean = mean(existing), newMean = added.length ? mean(added) : null;
  const price = existingMean - baselineMean;
  const composition = added.length ? added.length / plan.length * (newMean - existingMean) : 0;
  if (!Number.isFinite(a.metrics?.meanRent) || !Number.isFinite(b.metrics?.meanRent)) return unavailable('Recorded mean-rent measurements are required.');
  const delta = b.metrics.meanRent - a.metrics.meanRent;
  if (![price, composition, delta].every(Number.isFinite) || Math.abs(delta - (planMean - baselineMean)) > 1e-6 || Math.abs(price + composition - delta) > 1e-6) return unavailable('Recorded rent delta does not reconcile with unit snapshots.');
  return {status:'available', month:b.state.month, price, composition, delta, baselineMean, existingMean, newMean, existingCount:existing.length, newCount:added.length, denominator:plan.length};
}

export function renderRentDecomposition(container, result) {
  const doc = container.ownerDocument, root = doc.createElement('section');
  root.className = 'fm-rent-decomposition';
  const text = (tag, value) => {const node = doc.createElement(tag); node.textContent = value; root.append(node); return node;};
  text('h3', 'Mechanism Microscope · mean unit rent');
  if (result.status !== 'available') text('p', `Decomposition unavailable: ${result.reason}`);
  else {
    const exact = n => `${n.toFixed(6)} USD/month`;
    const label = `Existing-unit rent change: ${exact(result.price)}; composition effect: ${exact(result.composition)}; total: ${exact(result.delta)}.`;
    text('p', `Month ${result.month} · ${label}`);
    const bar = text('div', ''); bar.className = 'fm-rent-stack'; bar.setAttribute('role','img'); bar.setAttribute('aria-label',label);
    const magnitude = Math.abs(result.price) + Math.abs(result.composition);
    for (const [name,value,color] of [['Existing-unit rent change',result.price,'#5abce6'],['New-unit composition',result.composition,'#e6ae5a']]) {
      const segment = doc.createElement('span'); segment.style.width = `${magnitude ? Math.abs(value)/magnitude*100 : 50}%`; segment.style.background = color; segment.title = `${name}: ${exact(value)}`; bar.append(segment);
    }
    text('p', `Existing units: ${result.existingCount}; new units: ${result.newCount}; denominator: ${result.denominator} total plan units (including vacant units). New-unit share: ${result.newCount}/${result.denominator}.`);
    text('p', 'Δ = (existing plan mean − baseline mean) + (new units / total plan units) × (new mean − existing plan mean). Bar lengths show absolute magnitudes; signed values above sum to the recorded delta.');
    text('p', 'Accounting decomposition of synthetic model results; existing-unit rent changes are not incumbent household savings.');
  }
  container.append(root);
}
