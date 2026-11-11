import { cityEntityId } from '../causal/demo.js';

const categories = {
  people: { label: 'People', description: 'Modeled commute demand and household relocations.' },
  money: { label: 'Money', description: 'Recorded city revenue, operating spending, and policy funding.' },
  energy: { label: 'Energy', description: 'Electricity demand at district utilities in model demand units.' },
  water: { label: 'Water', description: 'Water demand at district utilities in model demand units.' },
  goods: { label: 'Goods', description: 'This city model has no recorded shipment routes.' },
  information: { label: 'Information', description: 'This city model has no recorded information flows.' },
};

const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const edgeId = (...parts) => JSON.stringify(parts);
const finite = value => Number.isFinite(value);
const node = (type, id, label) => ({ id: edgeId(type, id), label });
const byId = rows => new Map(rows.map(row => [row.id, row]));
const capitalize = text => text[0].toUpperCase() + text.slice(1);

function groupFlows(flows, resource) {
  const grouped = new Map();
  for (const flow of flows) {
    if (flow.resource !== resource || !finite(flow.amount)) continue;
    const id = edgeId(resource, flow.system, flow.from, flow.to);
    const previous = grouped.get(id);
    grouped.set(id, { ...flow, id, amount: flow.amount + (previous?.amount ?? 0) });
  }
  return [...grouped.values()];
}

function peopleEdges({ state, trips, selectedWorkerId }, district, flows) {
  const tripsByLink = new Map();
  const localByDistrict = new Map();
  for (const trip of trips ?? []) {
    const selected = trip.personId === selectedWorkerId;
    for (const linkId of trip.route) {
      const record = tripsByLink.get(linkId) ?? { count: 0, selected: false };
      record.count++;
      record.selected ||= selected;
      tripsByLink.set(linkId, record);
    }
    if (trip.route.length === 0 && trip.originId === trip.destinationId) {
      const record = localByDistrict.get(trip.originId) ?? { count: 0, selected: false };
      record.count++;
      record.selected ||= selected;
      localByDistrict.set(trip.originId, record);
    }
  }
  const edges = (state.links ?? []).map(link => {
    const usage = tripsByLink.get(link.id);
    return {
      id: edgeId('link', link.id),
      from: district(link.from),
      to: district(link.to),
      kind: `${capitalize(link.mode)} commute demand`,
      amount: link.flow,
      unit: 'assigned trips',
      source: 'Transport system · CityState.links',
      selected: usage?.selected ?? false,
      closed: link.closed === true,
      details: [
        link.closed ? 'Closed this month' : `Link travel time · ${number.format(link.travelTime)} min`,
        `Capacity · ${number.format(link.capacity)} model trips`,
        Array.isArray(trips) ? `Trip records using this link · ${usage?.count ?? 0}` : 'Individual trip records unavailable',
      ],
      evidence: { linkId: link.id },
    };
  });
  for (const [id, usage] of localByDistrict) {
    edges.push({
      id: edgeId('local-commute', id), from: district(id), to: district(id),
      kind: 'Local commute demand', amount: usage.count, unit: 'trips',
      source: 'Transport system · monthly Trip records',
      selected: usage.selected, details: ['Trips stayed in the same district.'],
    });
  }
  for (const flow of groupFlows(flows, 'people')) {
    edges.push({
      id: flow.id, from: district(flow.from), to: district(flow.to),
      kind: 'Household relocations', amount: flow.amount, unit: 'people',
      source: 'Housing system · CityState.flows',
      details: ['Counts household members who moved during the month.'],
    });
  }
  return edges;
}

function moneyEdges(state, flows) {
  const policies = byId(state.policies ?? []);
  const labels = { city: 'City treasury', economy: 'City economy', operations: 'Public operations' };
  const account = id => {
    const policy = policies.get(id);
    return node('account', id, policy ? `${capitalize(policy.type)} policy · ${id}` : labels[id] ?? id);
  };
  return groupFlows(flows, 'money').map(flow => ({
    id: flow.id, from: account(flow.from), to: account(flow.to),
    kind: flow.to === 'city' ? 'City revenue' : flow.to === 'operations' ? 'Operating expense' : 'Policy funding',
    amount: flow.amount, unit: 'illustrative USD',
    source: `${capitalize(flow.system)} system · CityState.flows`,
    details: ['Ledger transfers for the selected month.'],
    evidence: policies.has(flow.to) ? { policyId: flow.to } : undefined,
  }));
}

function utilityEdges(state, flows, type, district) {
  const utilities = byId(state.utilities ?? []);
  return groupFlows(flows, 'utility demand').filter(flow => utilities.get(flow.to)?.type === type).map(flow => {
    const utility = utilities.get(flow.to);
    const home = district(utility.districtId);
    return {
      id: flow.id, from: district(flow.from), to: node('utility', utility.id, `${home.label} ${type === 'electric' ? 'electricity' : 'water'} utility`),
      kind: type === 'electric' ? 'Electricity demand' : 'Water demand',
      amount: flow.amount, unit: 'model demand units',
      source: 'Utilities system · CityState.flows and CityState.utilities',
      details: [
        `Effective capacity · ${number.format(utility.effectiveCapacity ?? utility.capacity)} model units`,
        `Share of demand served · ${number.format(utility.serviceLevel * 100)}%`,
      ],
      evidence: { districtId: utility.districtId, utilityType: utility.type },
    };
  });
}

export function projectLivingNetwork(snapshot, category) {
  const { state } = snapshot;
  const districts = byId(state.districts);
  const district = id => node('district', id, districts.get(id)?.name ?? id ?? 'Unassigned');
  const flows = (state.flows ?? []).filter(flow => flow.time === state.month);
  switch (category) {
    case 'people': return peopleEdges(snapshot, district, flows);
    case 'money': return moneyEdges(state, flows);
    case 'energy': return utilityEdges(state, flows, 'electric', district);
    case 'water': return utilityEdges(state, flows, 'water', district);
    default: return [];
  }
}

export function livingNetworkEvidence(edge, events, month) {
  if (!edge.evidence) return [];
  const { linkId, policyId, districtId, utilityType } = edge.evidence;
  return (events ?? []).filter(event => {
    const source = event.payload?.source ?? event;
    if ((source.simulationTime ?? event.context?.tick) !== month) return false;
    const payload = source.payload ?? {};
    if (linkId && payload.linkId === linkId) return true;
    if (policyId && payload.policyId === policyId) return true;
    if (utilityType && source.geographyId === districtId && payload.utility === utilityType) return true;
    // World causal traces carry exact canonical entity IDs for links and policies.
    const expectedKind = linkId ? 'link' : policyId ? 'policy' : null;
    if (!expectedKind || event.type === 'MODEL_INPUTS' || !event.context?.worldId) return false;
    const entity = cityEntityId(event.context.worldId, expectedKind, linkId ?? policyId);
    return event.entityIds?.includes(entity);
  }).map(event => ({ id: event.id, type: event.eventType ?? event.type, provenance: event.provenance?.source }));
}

function element(tag, className, text) {
  const result = document.createElement(tag);
  result.className = className;
  if (text !== undefined) result.textContent = text;
  return result;
}

function svgElement(tag, attributes = {}) {
  const result = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) result.setAttribute(key, value);
  return result;
}

function formatAmount(edge) {
  const amount = edge.unit === 'illustrative USD' ? money.format(edge.amount) : number.format(edge.amount);
  return `${amount} ${edge.unit}`;
}

function relationshipLabel(edge) {
  return `${edge.from.label} → ${edge.to.label} · ${edge.kind}`;
}

let graphId = 0;

function drawGraph(graph, edges, selected, select, markerId) {
  const visible = [...edges].sort((a, b) =>
    Number(b.id === selected) - Number(a.id === selected) ||
    Number(Boolean(b.selected)) - Number(Boolean(a.selected)) ||
    b.amount - a.amount,
  ).slice(0, 48);
  const columns = ['from', 'to'].map(side => new Map(visible.map(edge => [edge[side].id, edge[side].label])));
  const height = Math.max(120, 44 * Math.max(...columns.map(column => column.size)));
  const positions = columns.map(column => new Map([...column.keys()].map((id, index) => [id, height * (index + .5) / column.size])));
  graph.setAttribute('viewBox', `0 0 700 ${height}`);
  const defs = svgElement('defs');
  const marker = svgElement('marker', {
    id: markerId, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto',
  });
  marker.append(svgElement('path', { d: 'M0 0 L10 5 L0 10 Z', fill: 'context-stroke' }));
  defs.append(marker);
  graph.replaceChildren(defs);
  const parallel = new Map();
  for (const edge of visible) {
    const y1 = positions[0].get(edge.from.id);
    const y2 = positions[1].get(edge.to.id);
    const key = edgeId(edge.from.id, edge.to.id);
    const sibling = parallel.get(key) ?? 0;
    parallel.set(key, sibling + 1);
    const bend = sibling === 0 ? 0 : (sibling % 2 ? 1 : -1) * Math.ceil(sibling / 2) * 28;
    const path = svgElement('path', {
      d: `M 200 ${y1} C 280 ${y1 + bend}, 420 ${y2 + bend}, 500 ${y2}`,
      class: 'living-network__line',
      'marker-end': `url(#${markerId})`,
      'data-active': edge.id === selected,
      'data-worker': Boolean(edge.selected),
      'data-closed': Boolean(edge.closed),
      'data-flowing': edge.amount > 0 && !edge.closed,
    });
    const title = svgElement('title');
    title.textContent = `${relationshipLabel(edge)} · ${formatAmount(edge)}`;
    path.append(title);
    path.addEventListener('click', () => select(edge.id));
    graph.append(path);
  }
  columns.forEach((column, index) => {
    for (const [id, label] of column) {
      const x = index ? 508 : 192;
      const text = svgElement('text', { x, y: positions[index].get(id), 'text-anchor': index ? 'start' : 'end' });
      text.textContent = label.length > 24 ? label.slice(0, 23) + '…' : label;
      const title = svgElement('title');
      title.textContent = label;
      text.append(title);
      graph.append(text);
    }
  });
  return visible.length;
}

export function mountLivingNetwork(host) {
  const markerId = `living-network-arrow-${++graphId}`;
  const heading = element('h2', '', 'Living Network Explorer');
  const filter = element('label', 'living-network__filter', 'Flow category');
  const picker = element('select', '');
  for (const [id, category] of Object.entries(categories)) picker.add(new Option(category.label, id));
  filter.append(picker);
  const description = element('p', 'living-network__description');
  const graph = svgElement('svg', { class: 'living-network__graph', 'aria-hidden': 'true' });
  const summary = element('p', 'living-network__summary');
  summary.setAttribute('role', 'status');
  const list = element('ul', 'living-network__edges');
  list.setAttribute('aria-label', 'Network connections');
  const detail = element('div', 'living-network__detail');
  detail.setAttribute('aria-live', 'polite');
  host.classList.add('living-network');
  host.replaceChildren(heading, filter, description, graph, summary, list, detail);

  let snapshot;
  let selected;
  let edges = [];
  function select(id) {
    selected = id;
    for (const button of list.querySelectorAll('button')) {
      button.setAttribute('aria-pressed', String(button.dataset.edgeId === selected));
    }
    drawGraph(graph, edges, selected, select, markerId);
    const edge = edges.find(row => row.id === selected);
    if (!edge) {
      detail.replaceChildren();
      return;
    }
    const evidence = livingNetworkEvidence(edge, snapshot.events, snapshot.state.month);
    detail.replaceChildren(
      element('h3', '', relationshipLabel(edge)),
      element('p', '', `Month ${snapshot.state.month} · ${formatAmount(edge)}`),
      ...edge.details.map(text => element('p', '', text)),
      element('p', '', `Source · ${edge.source}`),
      element('p', '', evidence.length ? 'Related recorded events' : 'No matching recorded event supplied for this connection.'),
      ...evidence.map(event => element('p', 'living-network__evidence', `${event.type.replaceAll('_', ' ')} · ${event.id}${event.provenance ? ` · ${event.provenance}` : ''}`)),
    );
  }
  function render() {
    host.hidden = !snapshot;
    if (!snapshot) return;
    const category = categories[picker.value];
    description.textContent = category.description;
    edges = projectLivingNetwork(snapshot, picker.value).sort((a, b) =>
      Number(Boolean(b.selected)) - Number(Boolean(a.selected)) || b.amount - a.amount,
    );
    list.replaceChildren(...edges.map(edge => {
      const item = element('li', '');
      const button = element('button', '', `${relationshipLabel(edge)} · ${formatAmount(edge)}${edge.closed ? ' · Closed' : ''}${edge.selected ? ' · Selected worker' : ''}`);
      button.type = 'button';
      button.dataset.edgeId = edge.id;
      button.addEventListener('click', () => select(edge.id));
      item.append(button);
      return item;
    }));
    graph.style.display = edges.length ? '' : 'none';
    summary.textContent = edges.length > 48
      ? `Showing 48 of ${edges.length} connections in the schematic. The list contains every connection.`
      : edges.length ? `${edges.length} ${edges.length === 1 ? 'connection' : 'connections'} in month ${snapshot.state.month}`
        : ['goods', 'information'].includes(picker.value) ? 'Flow data unavailable.' : 'No flows recorded for this month.';
    select(edges.some(edge => edge.id === selected) ? selected : edges[0]?.id);
  }

  picker.addEventListener('change', render);
  render();
  return value => {
    snapshot = value;
    render();
  };
}
