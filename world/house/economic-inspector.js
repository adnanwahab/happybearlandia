import { contextURL, contextFromURL, shellURL } from '../universe/navigation.js';
import { NavigationContextSchema, createLocalIdMap } from '../../shared/causality/index.js';

/** Explicit mapping is required; canonical identifiers are never guessed from URL text. */
export function householdEconomicActions(projection, { mappings, experimentLocalId }) {
  const map = createLocalIdMap(mappings);
  const localId = map.local(projection.householdId);
  if (!localId || !/^[A-Za-z0-9_-]{8,16}$/.test(experimentLocalId)) throw new TypeError('Saved household and experiment mapping required');
  const {universeId,worldId,scenarioId,runId,tick} = projection.context;
  const context = NavigationContextSchema.parse({universeId,worldId,scenarioId,runId,tick,entityId:projection.householdId});
  return [
    {id:'inspect-household',label:'Inspect household budget',href:contextURL('/world/causality/inspect.html',context)},
    {id:'open-saved-household',label:'Open saved household gameplay',href:contextURL(`/world/house/${encodeURIComponent(localId)}?experiment=${encodeURIComponent(experimentLocalId)}`,context)},
    {id:'compare-household-futures',label:'Compare household futures',href:shellURL('worldline',context)}
  ];
}

/** Historical economic inspection must resolve its exact recorded run/tick, never resume a save. */
export async function resolveHouseholdEconomicLink(url, { mappings, loadProjection }) {
  const parsed = new URL(url, 'https://happybearlandia.invalid');
  const context = contextFromURL(parsed.href);
  if (!context.runId || context.tick === undefined || !context.entityId) throw new TypeError('Household run and tick required');
  const map = createLocalIdMap(mappings);
  if (!map.local(context.entityId)) throw new TypeError('Unmapped household');
  const projection = await loadProjection(context);
  if (!projection || projection.householdId !== context.entityId) throw new TypeError('Recorded household projection unavailable');
  for (const key of ['universeId','worldId','scenarioId','runId','tick']) if (projection.context[key] !== context[key]) throw new TypeError('Recorded projection context mismatch');
  return projection;
}

/** Render a supplied economic projection beside gameplay, without touching its save. */
export function mountHouseholdEconomicInspector(container, projection, options) {
  const document = container.ownerDocument;
  const panel = document.createElement('section');
  panel.setAttribute('aria-label','Household economic inputs');
  const heading = document.createElement('h2');heading.textContent='Household economic inputs';
  const summary = document.createElement('p');
  summary.textContent=`Synthetic projection · tick ${projection.context.tick} · Disposable budget $${projection.budget.disposablePerDay.toFixed(2)}/day. Income $${projection.economicInputs.incomePerDay.toFixed(2)}, housing $${projection.economicInputs.housingCostPerDay.toFixed(2)}, commute $${projection.economicInputs.commuteCostPerDay.toFixed(2)} per day.`;
  const environment = document.createElement('p');
  environment.textContent=`Commute ${projection.environmentalInputs.commuteMinutesPerDay} minutes/day. Available services: ${projection.environmentalInputs.services.filter(s=>s.available).map(s=>s.id).join(', ') || 'none recorded'}.`;
  const notice = document.createElement('p');notice.textContent='Economic projections are separate from saved household activities and progress.';
  const nav = document.createElement('nav');nav.setAttribute('aria-label','Household economic inspector actions');
  for (const action of householdEconomicActions(projection,options)) { const link=document.createElement('a');link.href=action.href;link.textContent=action.label;nav.append(link,document.createTextNode(' ')); }
  panel.append(heading,summary,environment,notice,nav);container.append(panel);
  return {destroy(){panel.remove();}};
}
