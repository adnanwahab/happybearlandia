export function renderSocialNetwork(host, network, {onSelect} = {}) {
  const doc = host.ownerDocument;
  const add = (tag, text, parent = host) => {
    const element = doc.createElement(tag);
    element.textContent = text;
    parent.append(element);
    return element;
  };
  host.replaceChildren();
  add('h3', 'Recorded social network');
  add('p', 'Synthetic modeled residents. Connections come only from saved relationship ledger entries. Generated backstory, proximity and shared households do not add connections here. A saved tie does not prove a real-world relationship or a historical encounter.');
  const label = add('label', 'Network depth ');
  const picker = add('select', '', label);
  picker.setAttribute('aria-label', 'Network depth');
  for (let depth = 0; depth <= network.depth; depth++) {
    const option = add('option', String(depth), picker);
    option.value = String(depth);
  }
  picker.value = String(Math.min(1, network.depth));
  const p = network.provenance;
  add('p', `Source: ${p.authority ?? 'social.ties'} · Run: ${p.runId ?? 'unavailable'} · Model: ${p.modelVersion ?? 'unavailable'} · Seed: ${p.seed ?? 'unavailable'} · Minute: ${p.minute ?? 'unavailable'}`);
  const summary = add('p', '');
  summary.setAttribute('aria-live', 'polite');
  const graph = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  graph.setAttribute('viewBox', '0 0 600 600');
  graph.setAttribute('aria-hidden', 'true');
  graph.style.cssText = 'width:100%;max-width:420px;background:#182332';
  host.append(graph);
  const list = add('ul', '');
  list.setAttribute('aria-label', 'Recorded network residents');
  const edges = add('ul', '');
  edges.setAttribute('aria-label', 'Recorded network edges');
  const svg = (tag, attrs) => {
    const el = doc.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
    return el;
  };
  function render() {
    const nodes = network.nodes.filter(node => node.distance <= Number(picker.value));
    const ids = new Set(nodes.map(node => node.id));
    const connections = network.edges.filter(edge => ids.has(edge.from) && ids.has(edge.to));
    summary.textContent = `${nodes.length} residents · ${connections.length} ledger connections. ${connections.length ? '' : 'No saved connections at this depth. '}${network.truncated ? `Bounded snapshot: up to ${network.maxNodes} residents and ${network.maxEdges} edges; some connections omitted. ` : ''}${network.omittedInvalid ? `${network.omittedInvalid} invalid ledger entries omitted. ` : ''}Read-only snapshot; refresh the resident to update.`;
    graph.replaceChildren(); list.replaceChildren(); edges.replaceChildren();
    const positions = new Map(nodes.map((node, index) => {
      const angle = (index - 1) / Math.max(1, nodes.length - 1) * Math.PI * 2;
      return [node.id, node.distance === 0 ? [300, 300] : [300 + 240 * Math.cos(angle), 300 + 240 * Math.sin(angle)]];
    }));
    for (const edge of connections) {
      const [x1, y1] = positions.get(edge.from), [x2, y2] = positions.get(edge.to);
      graph.append(svg('line', {x1, y1, x2, y2, stroke: '#8db4d4', 'stroke-width': 2}));
      const row = add('li', `${edge.from} ↔ ${edge.to} · ${edge.label} · Ledger ID: ${edge.id}`, edges);
      row.dataset.ledgerId = edge.id;
    }
    for (const [index, node] of nodes.entries()) {
      const [cx, cy] = positions.get(node.id);
      const dot = svg('circle', {cx, cy, r: 12, fill: node.distance === 0 ? '#f4cb79' : '#7bcac4'});
      const title = svg('title', {}); title.textContent = node.label; dot.append(title); graph.append(dot);
      const number = svg('text', {x: cx, y: cy + 5, 'text-anchor': 'middle', fill: '#111'});
      number.textContent = String(index + 1); graph.append(number);
      const item = add('li', `${index + 1}. ${node.label} · ${node.distance} hops`, list);
      if (onSelect) {
        const button = add('button', 'Inspect resident', item); button.type = 'button';
        button.onclick = () => onSelect(node.id);
      }
    }
  }
  picker.addEventListener('change', render);
  render();
}
