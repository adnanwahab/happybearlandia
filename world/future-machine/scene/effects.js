import {createSpatialMapping} from './mapping.js';

const key = row => `${row.collection}:${row.id}`;
function changes(diff) {
  if (!diff) return [];
  if (Array.isArray(diff.entities)) return diff.entities;
  return Object.entries(diff.entities || {}).flatMap(([collection, group]) =>
    ['added', 'removed', 'modified'].flatMap(type => (group?.[type] || []).map(row => ({...row, collection}))));
}
/** Exact collection-scoped identities; no household-to-building inference. */
export function changedEntityKeys(diff) {
  return new Set(changes(diff).filter(row => typeof row.id === 'string' && typeof row.collection === 'string').map(key));
}

/**
 * Presentation only: changed must come from the current diff. Each mesh owns its
 * cloned materials until dispose(). Reuse a mesh across recorded rows to tween
 * height; new inventory appears at its recorded full size, never fake progress.
 * tick uses requestAnimationFrame's monotonic milliseconds; no internal RAF.
 */
export function createVisualEffects({THREE, reducedMotion = false} = {}) {
  if (!THREE?.Color) throw new TypeError('Three Color required');
  const entries = new Map();
  let disposed = false;
  function restore(entry) {
    entry.mesh.material = entry.original;
    entry.mesh.scale.copy(entry.scale);
    entry.mesh.position.copy(entry.position);
    for (const material of entry.materials) material.dispose();
  }
  function paint(entry, pulse = 0) {
    for (let i = 0; i < entry.materials.length; i++) {
      const material = entry.materials[i], original = entry.originals[i];
      if (!material.emissive) continue;
      if (entry.selected || (entry.changed && !entry.ghost)) {
        material.emissive.set(entry.selected ? 0xffc857 : 0x40d9c4);
        material.emissiveIntensity = (entry.selected ? .65 : .3) + pulse * .25;
      } else {
        material.emissive.copy(original.emissive || new THREE.Color(0));
        material.emissiveIntensity = original.emissiveIntensity ?? 1;
      }
    }
  }
  return {
    apply(mesh, row, {changed = false, selected = false, ghost = false, kind} = {}) {
      if (disposed) return;
      if (!mesh?.material || !row) throw new TypeError('Mesh and mapped row required');
      let entry = entries.get(mesh);
      if (!entry) {
        const original = mesh.material, originals = Array.isArray(original) ? original : [original];
        const materials = originals.map(material => material.clone());
        entry = {mesh, original, originals, materials, scale: mesh.scale.clone(), position: mesh.position.clone()};
        mesh.material = Array.isArray(original) ? materials : materials[0];
        entries.set(mesh, entry);
      }
      const previous = entry.row;
      const sameShape=previous&&key(previous)===key(row)&&previous.polygon===Boolean(row.polygon)&&previous.height===row.height;
      if(sameShape){
        // Retained meshes may currently be partway through a height tween.
        // A highlight change must keep the recorded target origin and clock.
        entry.position.x=mesh.position.x;entry.position.z=mesh.position.z;
        const unchanged=entry.changed===Boolean(changed)&&entry.selected===Boolean(selected)&&entry.ghost===Boolean(ghost);
        if(unchanged)return;
        entry.changed=Boolean(changed);entry.selected=Boolean(selected);entry.ghost=Boolean(ghost);
        if(reducedMotion||ghost||!changed){
          entry.active=false;
          mesh.scale.copy(entry.scale);mesh.position.copy(entry.position);
        }
        paint(entry);
        return;
      }
      // The stage updates geometry/position to this recorded row before apply.
      entry.position.copy(mesh.position);
      const next = {collection: row.collection, id: row.id, height: row.height, polygon: Boolean(row.polygon)};
      const same = previous && key(previous) === key(next);
      const transition = changed && !ghost && !reducedMotion && same &&
        Number.isFinite(previous.height) && previous.height > 0 && Number.isFinite(next.height) && next.height > 0 && previous.height !== next.height;
      // Caller supplies current geometry. Scale interpolates only its recorded height.
      entry.from = transition ? previous.height / next.height : 1;
      entry.row = next;
      entry.changed = Boolean(changed); entry.selected = Boolean(selected); entry.ghost = Boolean(ghost);
      entry.active = !reducedMotion && !ghost && changed && (transition || kind === 'added' || !same);
      entry.start = null;
      entry.mesh.scale.copy(entry.scale);
      entry.mesh.position.copy(entry.position);
      if (transition) {
        entry.mesh.scale.y = entry.scale.y * entry.from;
        if (!entry.row.polygon) entry.mesh.position.y = entry.position.y + entry.row.height * (entry.from - 1) / 2;
      }
      paint(entry);
    },
    tick(now) {
      if (disposed || !Number.isFinite(now)) return false;
      let needsMoreFrames = false;
      for (const entry of entries.values()) {
        if (!entry.active) continue;
        entry.start ??= now;
        const t = Math.max(0, Math.min(1, (now - entry.start) / 900));
        const eased = t * t * (3 - 2 * t);
        const ratio = entry.from + (1 - entry.from) * eased;
        entry.mesh.scale.y = entry.scale.y * ratio;
        // Box geometry is centered; extruded footprints are already ground anchored.
        if (!entry.row.polygon) entry.mesh.position.y = entry.position.y + entry.row.height * (ratio - 1) / 2;
        paint(entry, Math.sin(Math.PI * t));
        entry.active = t < 1;
        needsMoreFrames = true; // Include the final settled frame.
      }
      return needsMoreFrames;
    },
    remove(mesh) {
      const entry=entries.get(mesh);if(entry){restore(entry);entries.delete(mesh);}
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const entry of entries.values()) restore(entry);
      entries.clear();
    },
  };
}
