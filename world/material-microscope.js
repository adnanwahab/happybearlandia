import {selectedAPIGeometry} from './geometry-inspector.js';

/** Only explicit contributor tags qualify as material evidence. Never infer from color/kind. */
export function buildingMaterialTags(tags = {}) {
  return Object.fromEntries(['building:material', 'roof:material'].flatMap(key => {
    const value = tags?.[key];
    return typeof value === 'string' && value.trim() && value.length <= 300 ? [[key, value]] : [];
  }));
}

export function inspectBuildingMaterial(area, id, surface = 'wall') {
  if (!['wall', 'roof'].includes(surface)) throw new Error('Unsupported surface');
  const sourceRecord = selectedAPIGeometry(area, id);
  if (!sourceRecord) return {status: 'missing', message: 'Original source record unavailable. Construction material unknown.'};
  const key = surface === 'wall' ? 'building:material' : 'roof:material';
  const value = buildingMaterialTags(sourceRecord.geometry.materialTags)[key];
  return {status: value && area.source === 'osm' ? 'tagged' : 'unsupported', sourceRecord,
    message: value && area.source === 'osm'
      ? `Contributor-reported ${surface} material: ${value} (${key}). Not independently verified; not a modeled construction classification.`
      : `${surface === 'wall' ? 'Wall' : 'Roof'} construction material unknown: no supported classification in this source record.`,
    renderer: 'Renderer-only appearance: authored colors and procedural shading. Illustrative, not evidence of real-world construction material.',
    rendererSource: '/world/render/README.md'};
}

/** Static disclosure: no extra render target, animation loop, timers or global listeners. */
export function mountMaterialMicroscope(container, {area, buildingId, onSource = () => {}, readFrameStats = () => null} = {}) {
  const doc = container.ownerDocument;
  const root = doc.createElement('details');
  root.dataset.materialMicroscope = String(buildingId);
  const summary = doc.createElement('summary'); summary.textContent = '🔎 Material magnifier'; root.append(summary);
  const label = doc.createElement('label'); label.textContent = 'Building surface ';
  const select = doc.createElement('select');
  for (const surface of ['wall', 'roof']) { const option = doc.createElement('option'); option.value = surface; option.textContent = surface; select.append(option); }
  label.append(select); root.append(label);
  const output = doc.createElement('div'); output.setAttribute('role', 'status'); root.append(output);
  const source = doc.createElement('button'); source.type = 'button'; source.textContent = 'Open original source record'; root.append(source);
  source.onclick = () => onSource();
  const update = () => {
    const started = performance.now(); output.replaceChildren();
    try {
      const result = inspectBuildingMaterial(area, buildingId, select.value);
      root.dataset.state = result.status;
      for (const text of [`Original entity ID: ${buildingId}`, `Source: ${result.sourceRecord?.source ?? 'Unavailable'}`, result.message, result.renderer].filter(Boolean)) {
        const p = doc.createElement('p'); p.textContent = text; output.append(p);
      }
      if (result.rendererSource) { const a = doc.createElement('a'); a.href = result.rendererSource; a.textContent = 'Renderer appearance source'; output.append(a); }
      source.disabled = !result.sourceRecord;
      // Existing frame pacing instrument; sampled on interaction, never polled.
      root.materialMetrics = {updateCpuMs: performance.now() - started, frameStats: readFrameStats()};
    } catch {
      root.dataset.state = 'failure'; output.textContent = 'Material inspection failed. No construction classification can be reported.'; source.disabled = true;
    }
  };
  select.onchange = update; root.ontoggle = () => { if (root.open) update(); };
  root.style.cssText = 'margin-top:12px;overflow-wrap:anywhere';
  select.style.minHeight = source.style.minHeight = '44px';
  container.append(root); update(); return root;
}
