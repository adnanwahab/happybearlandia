import * as THREE from 'three';
import { createHoneyTrail, HONEY_DROPS } from './honey-trail.js';

export function createHoneyTrailView(scene) {
  const trail = createHoneyTrail();
  const geometry = new THREE.TorusGeometry(0.7, 0.18, 8, 20);
  const material = new THREE.MeshStandardMaterial({
    color: '#ffd35a', emissive: '#e58b14', emissiveIntensity: 0.8,
    metalness: 0.25, roughness: 0.3,
  });
  const markers = HONEY_DROPS.map(([x, y, z]) => {
    const marker = new THREE.Mesh(geometry, material);
    marker.position.set(x, y + 1.5, z);
    scene.add(marker);
    return marker;
  });
  const panel = document.createElement('section');
  panel.id = 'honey-trail';
  panel.setAttribute('aria-label', 'Honey Trail challenge');
  panel.innerHTML = `<strong>🍯 Honey Trail</strong>
    <p>Collect all 8 glowing honey drops. Follow the trail to the stairs!</p>
    <p class="honey-controls">WASD to move · Space to jump · Drag to look</p>
    <div class="honey-progress" role="status" aria-live="polite"></div>
    <div class="honey-time"></div>
    <button type="button">Restart trail</button>`;
  const progress = panel.querySelector('.honey-progress');
  const timer = panel.querySelector('.honey-time');
  const button = panel.querySelector('button');
  let previousCount = -1;
  function render(state) {
    markers.forEach((marker, index) => { marker.visible = !state.collected.includes(index); });
    if (previousCount !== state.collected.length) {
      progress.textContent = state.complete
        ? 'Trail complete! All 8 honey drops collected!'
        : `${state.collected.length} / 8 collected${state.started ? ' · Keep going!' : ' · Timer starts on first pickup'}`;
      previousCount = state.collected.length;
    }
    timer.textContent = `${state.elapsed.toFixed(1)}s${state.best === null ? '' : ` · Session best: ${state.best.toFixed(1)}s`}`;
    button.textContent = state.complete ? 'Play again — beat your time' : 'Restart trail';
  }
  button.addEventListener('click', () => {
    previousCount = -1;
    render(trail.restart());
    button.blur();
  });
  document.body.appendChild(panel);
  render(trail.snapshot());
  return {
    update(position, delta, time) {
      markers.forEach((marker, index) => {
        marker.rotation.y = time * 1.5;
        marker.position.y = HONEY_DROPS[index][1] + 1.5 + Math.sin(time * 3 + index) * 0.2;
      });
      render(trail.update([position.x, position.y, position.z], delta));
    },
  };
}
