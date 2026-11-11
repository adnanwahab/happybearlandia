const NODE_LIMIT = 24;
const EDGE_LIMIT = 32;

const relations = new Map([
  ['causes', 'Causes'],
  ['contributes', 'Contributes to'],
  ['constrains', 'Constrains'],
  ['correlates', 'Correlates with'],
]);

const incompleteReasons = new Map([
  ['depth-limit', 'Traversal depth limit reached.'],
  ['edge-limit', 'Server connection limit reached.'],
  ['node-limit', 'Server record limit reached.'],
  ['missing-dependency', 'A dependency record is unavailable.'],
  ['missing-evidence', 'A referenced evidence record is unavailable.'],
  ['evidence-limit', 'Server evidence limit reached.'],
  ['run-running', 'The stored run is still running.'],
  ['run-failed', 'The stored run failed before completion.'],
]);

export const graphStyles = `
  .evidence-graph { margin-top: 1rem; }
  .evidence-graph h3, .evidence-graph h4 { margin: 0 0 .55rem; }
  .evidence-graph__metadata { color: #365e55; font-size: .88rem; }
  .evidence-graph__notice { border-left: 3px solid #94641c; background: #fff7df; padding: .65rem .8rem; }
  .evidence-graph__notice p { margin: .3rem 0; }
  .evidence-graph__list { display: grid; gap: .55rem; padding: 0; list-style: none; }
  .evidence-graph__edge {
    display: grid; grid-template-columns: minmax(0, 1fr) minmax(7rem, .5fr) minmax(0, 1fr);
    gap: .55rem; align-items: stretch; padding: .5rem; border: 1px solid #b6cbc3; border-radius: .55rem;
  }
  .evidence-graph__card {
    position: relative; display: grid; justify-items: start; gap: .22rem; min-width: 0;
    padding: .6rem .7rem; border: 1px solid #6b968a; border-radius: .42rem; color: #123b31;
    background: #e8f4ee; text-align: left; overflow-wrap: anywhere;
  }
  .evidence-graph__card.is-selected { border: 2px solid #28664f; background: #d7eee2; }
  .evidence-graph__card h5 { margin: 0; font-size: 1rem; }
  .evidence-graph__card button { position: absolute; inset: 0; border: 0; border-radius: inherit; background: transparent; }
  .evidence-graph__card:hover { background: #d7eee2; }
  .evidence-graph__card small { color: #3a5e54; font-size: .77rem; }
  .evidence-graph__connector {
    align-self: center; min-width: 0; color: #315a50; text-align: center;
    font-size: .86rem; font-weight: 650; overflow-wrap: anywhere;
  }
  .evidence-graph__connector span { display: block; }
  .evidence-graph__connector .evidence-graph__edge-mark { font-size: 1.4rem; line-height: 1; }
  .evidence-graph__connector.is-association { color: #5b4979; }
  .evidence-graph__raw { margin-top: .9rem; }
  .evidence-graph__raw summary { cursor: pointer; }
  @media (max-width: 580px) {
    .evidence-graph__edge { grid-template-columns: minmax(0, 1fr); }
    .evidence-graph__connector { justify-self: start; text-align: left; padding: .15rem .65rem; }
    .evidence-graph__edge-mark.is-directed { transform: rotate(90deg); transform-origin: .6rem center; }
  }
`;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function recordLabel(record) {
  return record.label || record.type || record.metricId || record.id;
}

function recordCard(record, { selected = false, heading = false, onSelect }) {
  const root = element('div', undefined, 'evidence-graph__card');
  const button = element('button');
  button.type = 'button';
  button.setAttribute('aria-label', `Inspect ${recordLabel(record)}`);
  button.dataset.recordId = record.id;
  if (selected) {
    button.setAttribute('aria-current', 'true');
    root.classList.add('is-selected');
  }
  root.append(
    element(heading ? 'h5' : 'strong', recordLabel(record)),
    element('small', `Provenance · ${record.provenance?.kind || 'unavailable'}`),
    element('small', record.id),
    button,
  );
  button.onclick = () => onSelect(record);
  return { root, button };
}

function relationCard(edge, returnedEvidenceIds) {
  const association = edge.relation === 'correlates';
  const connector = element('div', undefined, 'evidence-graph__connector');
  if (association) connector.classList.add('is-association');
  const symbol = element('span', association ? '···' : '→', 'evidence-graph__edge-mark');
  if (!association) symbol.classList.add('is-directed');
  symbol.setAttribute('aria-hidden', 'true');
  const cited = [...new Set(edge.evidenceIds ?? [])];
  const returned = cited.filter(id => returnedEvidenceIds.has(id)).length;
  const evidenceLabel = `${returned} evidence record${returned === 1 ? '' : 's'} returned` +
    (returned !== cited.length ? ` of ${cited.length} cited` : '');
  connector.append(symbol, element('span', relations.get(edge.relation)), element('span', evidenceLabel));
  if (association) connector.append(element('span', 'Association only'));
  return connector;
}

function returnedRecords(data, targetId) {
  const nodes = new Map();
  for (const node of data.nodes ?? []) {
    if (typeof node?.id === 'string' && node.id && !nodes.has(node.id)) nodes.set(node.id, node);
  }
  const ordered = [...nodes.values()];
  const target = nodes.get(targetId);
  const shown = new Map((target ? [target, ...ordered.filter(node => node !== target)] : ordered)
    .slice(0, NODE_LIMIT).map(node => [node.id, node]));
  const valid = [];
  let missingEndpoints = 0;
  let unsupportedRelations = 0;
  for (const edge of data.edges ?? []) {
    if (!nodes.has(edge?.fromId) || !nodes.has(edge?.toId)) {
      missingEndpoints++;
    } else if (!relations.has(edge.relation)) {
      unsupportedRelations++;
    } else {
      valid.push(edge);
    }
  }
  const edges = valid.filter(edge => shown.has(edge.fromId) && shown.has(edge.toId)).slice(0, EDGE_LIMIT);
  return { target, shown, edges, missingEndpoints, unsupportedRelations, nodeCount: nodes.size, edgeCount: valid.length };
}

export function renderEvidenceGraph(data, selectedId, onSelect) {
  const { target, shown, edges, missingEndpoints, unsupportedRelations, nodeCount, edgeCount } =
    returnedRecords(data, selectedId);
  const evidenceIds = new Set((data.evidence ?? []).map(record => record?.id).filter(Boolean));
  const root = element('section', undefined, 'evidence-graph');
  root.setAttribute('aria-label', 'Recorded evidence graph');
  root.append(element('h3', 'Recorded evidence graph'));
  root.append(element('p', `${evidenceIds.size} evidence record${evidenceIds.size === 1 ? '' : 's'} returned`,
    'evidence-graph__metadata'));

  const notes = [];
  if (!target) notes.push('The selected target record was not returned.');
  if (missingEndpoints) notes.push(`${missingEndpoints} returned connection${missingEndpoints === 1 ? '' : 's'} omitted because an endpoint record is unavailable.`);
  if (unsupportedRelations) notes.push(`${unsupportedRelations} connection${unsupportedRelations === 1 ? '' : 's'} omitted because the relationship type is unsupported.`);
  const missingIds = new Set(data.missingIds ?? []);
  if (missingIds.size) notes.push(`${missingIds.size} referenced record${missingIds.size === 1 ? ' is' : 's are'} unavailable.`);
  for (const reason of new Set(data.reasons ?? [])) {
    if (incompleteReasons.has(reason)) notes.push(incompleteReasons.get(reason));
  }
  if (shown.size < nodeCount || edges.length < edgeCount) {
    notes.push(`Preview shows ${shown.size} of ${nodeCount} records and ${edges.length} of ${edgeCount} supported connections. Open the response below for the complete returned data.`);
  }
  if (notes.length) {
    const caveat = element('aside', undefined, 'evidence-graph__notice');
    caveat.setAttribute('aria-label', 'Evidence coverage');
    caveat.append(...notes.map(note => element('p', note)));
    root.append(caveat);
  }

  let targetButton;
  if (target) {
    root.append(element('h4', 'Selected record'));
    const card = recordCard(target, { selected: true, heading: true, onSelect });
    targetButton = card.button;
    root.append(card.root);
  }
  const rendered = new Set(target ? [target.id] : []);
  const connected = new Set();
  function connectionCard(record) {
    const card = recordCard(record, { heading: !rendered.has(record.id), onSelect });
    rendered.add(record.id);
    return card.root;
  }
  if (edges.length) {
    root.append(element('h4', 'Recorded connections'));
    const connections = element('ul', undefined, 'evidence-graph__list');
    for (const edge of edges) {
      const row = element('li', undefined, 'evidence-graph__edge');
      row.dataset.relation = edge.relation;
      row.append(connectionCard(shown.get(edge.fromId)),
        relationCard(edge, evidenceIds), connectionCard(shown.get(edge.toId)));
      connections.append(row);
      connected.add(edge.fromId);
      connected.add(edge.toId);
    }
    root.append(connections);
  } else {
    root.append(element('p', 'No recorded connections are shown for this response.'));
  }
  const detached = [...shown.values()].filter(node => node !== target && !connected.has(node.id));
  if (detached.length) {
    root.append(element('h4', 'Other returned records'));
    const records = element('ul', undefined, 'evidence-graph__list');
    for (const node of detached) {
      const item = element('li');
      item.append(recordCard(node, { heading: true, onSelect }).root);
      records.append(item);
    }
    root.append(records);
  }
  if (!shown.size) root.append(element('p', 'No matching stored records in this response.'));

  const details = element('details', undefined, 'evidence-graph__raw');
  details.append(element('summary', 'Raw recorded response'));
  details.addEventListener('toggle', () => {
    if (details.open && !details.querySelector('pre')) details.append(element('pre', JSON.stringify(data, null, 2)));
  });
  root.append(details);
  return { root, targetButton };
}
