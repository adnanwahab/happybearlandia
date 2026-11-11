import { pairedHousingScene } from './model.js';
import { buildingDimensions } from '../../buildings/renderer.js';
const NS = 'http://www.w3.org/2000/svg';
const fmt = value => value === null ? 'Missing' : new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(value);

/** One SVG coordinate system/camera for both arms. No hidden rendering loop. */
export function mountHousingComparison(container, { onMonthChange, onInspect } = {}) {
  const doc = container.ownerDocument, root = doc.createElement('section');
  root.setAttribute('aria-label', 'Paired stored housing scenes');
  const title = doc.createElement('h3'); title.textContent = 'Same seed, same month: housing scenes';
  const slider = doc.createElement('input'); slider.type = 'range'; slider.min = '0'; slider.max = '120'; slider.value = '0'; slider.setAttribute('aria-label', 'Paired housing month');
  const status = doc.createElement('p'); status.setAttribute('role', 'status');
  const svg = doc.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 800 380'); svg.setAttribute('role', 'group'); svg.setAttribute('aria-label', 'Baseline and selected housing, identical scale'); svg.style.cssText = 'width:100%;background:#f0f5f4;color:#173b40';
  const note = doc.createElement('p'); root.append(title, slider, status, svg, note); container.append(root);
  let context = {}, month = 0, destroyed = false;
  const node = (parent, tag, attrs, text) => { const el = doc.createElementNS(NS, tag); for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value)); if (text !== undefined) el.textContent = text; parent.append(el); return el; };
  function render() {
    const pair = pairedHousingScene({ ...context, month }); svg.replaceChildren();
    const narrow = (root.clientWidth || doc.defaultView.innerWidth || 800) < 600;
    svg.setAttribute('viewBox', narrow ? '0 0 400 760' : '0 0 800 380');
    status.textContent = pair.available ? `Month ${month} · seed ${pair.seed} · model ${pair.modelVersion} · supply difference ${fmt(pair.supplyDelta)} homes` : pair.reason;
    note.textContent = pair.caveat || 'Select a supported stored housing future.';
    slider.value = String(month); slider.setAttribute('aria-valuetext', `Month ${month}`);
    if (!pair.available) return;
    slider.max = String(Math.max(0, ...pair.arms.flatMap(arm => { const run = context.results.runs.find(row => row.id === arm.runId); return (run.monthlyTimeline || run.timeline || []).map(row => row.month ?? row.year * 12); })));
    // Project charts use the union of exact IDs, preserving slots through reverse scrub.
    const heightMax = Math.max(1, ...context.results.runs.filter(run => pair.arms.some(arm => arm.runId === run.id)).flatMap(run => (run.projects || []).filter(p => p.proposal).map(p => buildingDimensions(p.proposal).height)));
    const ids = [...new Set(pair.arms.flatMap(arm => context.results.runs.find(run => run.id === arm.runId)?.projects?.map(p => p.projectId) || []))].sort();
    pair.arms.forEach((arm, index) => {
      const g = node(svg, 'g', { transform: narrow ? `translate(0 ${index * 380})` : `translate(${index * 400} 0)` });
      node(g, 'text', { x: 16, y: 24 }, `${index ? 'Selected' : 'Baseline'} · ${arm.runId}`);
      node(g, 'text', { x: 16, y: 49 }, `${fmt(arm.supply)} homes · vacancy ${fmt(arm.vacancy)}%`);
      node(g, 'rect', { x: 16, y: 65, width: 360, height: 35, fill: '#ccd8d8' });
      if (arm.supply !== null) node(g, 'rect', { x: 16, y: 65, width: Math.max(0, arm.supply) / pair.supplyMax * 360, height: 35, fill: '#286f82' });
      node(g, 'text', { x: 16, y: 120 }, 'Aggregate stock · fixed paired scale (homes)');
      node(g, 'rect', { x: 16, y: 136, width: 360, height: 20, fill: '#ccd8d8' });
      if (arm.vacancy !== null) node(g, 'rect', { x: 16, y: 136, width: Math.max(0, Math.min(100, arm.vacancy)) * 3.6, height: 20, fill: '#ba7326' });
      node(g, 'text', { x: 16, y: 177 }, 'Aggregate vacancy · 0–100%');
      node(g, 'text', { x: 16, y: 196, 'font-size': 10 }, 'Construction · shared height scale, schematic slots');
      if (ids.length > 12) node(g, 'text', { x: 16, y: 375, 'font-size': 10 }, 'First 12 project IDs shown; aggregate totals include all.');
      if (!arm.available) node(g, 'text', { x: 16, y: 210 }, 'No exact recorded snapshot for this month.');
      for (const project of arm.projects.filter(p => ids.indexOf(p.id) < 12)) {
        const slot = ids.indexOf(project.id), x = 16 + slot % 6 * 60, y = 255 + Math.floor(slot / 6) * 70;
        const dimensions = buildingDimensions(project.proposal);
        const height = Math.min(50, Math.max(0, project.state.floorsBuilt || 0) / dimensions.floors * dimensions.height / heightMax * 50);
        const button = node(g, 'g', { tabindex: 0, role: 'button', 'aria-label': `${project.id}: ${project.state.status}, ${project.state.completedUnits} completed homes`, 'data-project-id': project.id });
        node(button, 'rect', { x, y: y - height, width: 40, height: Math.max(1, height), fill: '#286f82', stroke: '#173b40' });
        node(button, 'text', { x, y: y + 16, 'font-size': 10 }, `${project.state.completedUnits} homes`);
        node(button, 'title', {}, `${project.id} · ${project.state.status} · ${project.state.floorsBuilt} floors · ${project.state.occupiedUnits} occupied homes; schematic normalized project height`);
        const inspect = () => {
          const detail = { ...project.source, state: structuredClone(project.state) };
          root.dispatchEvent(new doc.defaultView.CustomEvent('housing-comparison:inspect', { bubbles: true, detail }));
          onInspect?.(detail);
        };
        button.addEventListener('click', inspect); button.addEventListener('keydown', event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); inspect(); } });
      }
    });
  }
  const change = () => { month = Number(slider.value); render(); onMonthChange?.(month); };
  slider.addEventListener('input', change);
  const resize = () => { if (!destroyed) render(); };
  doc.defaultView.addEventListener?.('resize', resize);
  return { update(next = {}) { if (destroyed) return; context = next; if (Number.isInteger(next.month)) month = next.month; render(); }, destroy() { destroyed = true; doc.defaultView.removeEventListener?.('resize', resize); slider.removeEventListener('input', change); root.remove(); } };
}
