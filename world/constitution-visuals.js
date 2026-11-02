import { compilePlan } from './planspec.js';

export function resolveConstitutionPlan(payload, text) {
  payload = payload?.synthesis ?? payload;
  const rows = Array.isArray(payload) ? payload : payload?.packages || payload?.results || payload?.data?.packages || [];
  const row = rows.find(r => /balanced/i.test(r.name || r.label || '')) || rows[0];
  if (row) {
    const plan = compilePlan(row);
    if (plan.actions.length) return { plan, fallback: false };
  }
  if (/\b(drainage|drains?|detention|bayou)\b/i.test(text)) return { plan: compilePlan({ proposalIds: ['f_drainage'], label: 'Drainage what-if', source: 'local fallback' }), fallback: true };
  throw new Error('No proposals resolved. This idea needs a Dear Congress proposal and a simulation adapter.');
}

// Coordinates are illustrative, relative to the same town origin in both views.
export function constitutionGeometry(plan) {
  const rules = new Set(compilePlan(plan).actions.map(a => a.rule));
  const shapes = [];
  const box = (label, position, size, color) => shapes.push({label, position, size, color});
  if (rules.has('f_drainage')) {
    box('Drainage channel', [0, 1, 0], [120, 2, 5], '#279fb5');
    box('Drainage trench', [45, 0.5, 35], [5, 1, 70], '#5b8796');
    for (const x of [-30, 30]) box('Culvert', [x, 2, 0], [8, 4, 12], '#aaaeb7');
    for (const z of [-45, 75]) box('Detention basin', [65, 0.8, z], [35, 1.6, 25], '#368bb3');
  }
  if (rules.has('t_bus') || rules.has('t_brt')) {
    box('Transit corridor', [-50, 1, 0], [6, 2, 180], '#efb840');
    for (const z of [-70, 0, 70]) box('Transit stop', [-42, 4, z], [8, 8, 5], '#efb840');
  }
  if (rules.has('h_lots')) for (let i=0;i<4;i++) box('Potential housing', [-90+i*18, 9, 65], [12, 18, 12], '#a585de');
  return shapes;
}

export function mountConstitutionComparison({ THREE, scene, camera, controls, town, params }) {
  if (params.get('constitution') !== '1') return;
  controls.enableZoom = true;
  camera.position.set(180, 220, 250); controls.target.set(15, 0, 15); controls.update();
  let applying = false;
  const group = new THREE.Group(); scene.add(group);
  function announce() { parent.postMessage({ type:'constitution-camera', position:camera.position.toArray(), target:controls.target.toArray() }, location.origin); }
  controls.addEventListener('change', () => { if (!applying) announce(); });
  addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== parent) return;
    const data=event.data;
    if (data?.type === 'constitution-camera' && [data.position,data.target].every(v=>Array.isArray(v)&&v.length===3&&v.every(n=>Number.isFinite(n)&&Math.abs(n)<100000))) {
      applying=true; camera.position.fromArray(data.position); controls.target.fromArray(data.target); controls.update(); applying=false;
    }
    if (data?.type === 'constitution-plan') {
      for (const child of [...group.children]) { group.remove(child); child.geometry.dispose(); child.material.dispose(); }
      for (const shape of constitutionGeometry(data.plan)) {
        const mesh=new THREE.Mesh(new THREE.BoxGeometry(...shape.size),new THREE.MeshStandardMaterial({color:shape.color,transparent:true,opacity:0.8}));
        mesh.position.fromArray(shape.position); mesh.name=shape.label; group.add(mesh);
      }
    }
  });
  parent.postMessage({type:'constitution-ready', source:town.source},location.origin);
}
