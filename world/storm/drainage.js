// Display-only contract. Never infer pipes or outflow from grid capacity.
export function drainageEdges(record, { arm, step } = {}) {
  if (record?.version !== 'drainage-edges.v1' || record.arm !== arm || record.step !== step ||
      !record.source || !record.runId || !['observed', 'synthetic', 'modeled'].includes(record.kind) ||
      !['m³/s', 'm³ per model step'].includes(record.units) || !Array.isArray(record.edges)) return [];
  const ids = new Set();
  return record.edges.flatMap(edge => {
    if (!edge.id || ids.has(edge.id) || !edge.source || !Array.isArray(edge.points) || edge.points.length < 2 ||
        !edge.points.every(p => Array.isArray(p) && p.length === 2 && p.every(n => Number.isFinite(n) && n >= 0 && n <= 1))) return [];
    ids.add(edge.id);
    const value = n => Number.isFinite(n) && n >= 0 ? n : null;
    return [{ ...edge, flow: value(edge.flow), overflow: value(edge.overflow) }];
  });
}

export function mountDrainage(host) {
  const details = document.createElement('details');
  details.className = 'storm-drainage';
  const summary = document.createElement('summary');
  summary.textContent = 'Drainage ribbons · recorded edges cutaway';
  const legend = document.createElement('p');
  legend.textContent = 'Recorded edge geometry only; normalized source coordinates, schematic cutaway, no inferred pipes or underground depth. Moving transparent marks indicate positive recorded flow; animation speed is decorative, not water velocity. Gray dashed = unknown; dry = recorded zero. Overflow is listed separately. Structural uncertainty unquantified.';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('aria-hidden', 'true');
  const readings = document.createElement('ul');
  details.append(summary, legend, status, svg, readings);
  host.append(details);
  let frame, destroyed = false;
  function draw() {
    if (destroyed || !details.open) return;
    const record = frame?.drainage;
    const edges = drainageEdges(record, frame);
    svg.replaceChildren(); readings.replaceChildren();
    svg.hidden = edges.length === 0;
    status.textContent = edges.length
      ? `${record.kind} · source ${record.source} · run ${record.runId} · ${record.arm} · step ${record.step} · ${record.units}`
      : 'Recorded drainage edges and edge flow/overflow unavailable for this arm and step. Cell capacity is not edge outflow. No pipes drawn.';
    for (const edge of edges) {
      const path = document.createElementNS(svg.namespaceURI, 'path');
      path.setAttribute('d', edge.points.map((p, i) => `${i ? 'L' : 'M'}${p[0] * 100},${p[1] * 100}`).join(' '));
      path.setAttribute('class', edge.flow === null ? 'unknown' : edge.flow > 0 ? 'flowing' : 'dry');
      svg.append(path);
      const li = document.createElement('li');
      const reading = n => n === null ? 'unknown' : `${n} ${record.units}`;
      li.textContent = `${edge.id} · source ${edge.source} · flow ${reading(edge.flow)}${edge.flow === 0 ? ' (dry)' : ''} · overflow ${reading(edge.overflow)}`;
      readings.append(li);
    }
  }
  details.addEventListener('toggle', draw);
  return {
    render(input) { if (!destroyed) { frame = input; draw(); } },
    destroy() { if (destroyed) return; destroyed = true; frame = undefined; details.removeEventListener('toggle', draw); details.remove(); svg.replaceChildren(); readings.replaceChildren(); },
  };
}
