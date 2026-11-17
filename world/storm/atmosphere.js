/** Presentation only: heightfield-water.v1 supplies no wind/cloud observations. */
export function atmosphereState(step) {
  const available = Number.isInteger(step) && step >= 0;
  return {
    available,
    // A repeating authored phase, never a velocity, elapsed time or storm strength.
    phase: available ? (step % 24) / 24 : 0,
    label: available
      ? `Step ${step} · Decorative wind/cloud layers. Wind speed (m/s) and direction: unavailable in heightfield-water.v1. Cloud cover: unavailable. Movement does not indicate storm strength.`
      : 'No storm snapshot. Wind speed, direction and cloud cover unavailable.',
  };
}

export function mountAtmosphere(viewport, host) {
  const layer = document.createElement('div');
  layer.className = 'storm-atmosphere';
  layer.setAttribute('aria-hidden', 'true');
  for (const kind of ['cloud', 'cloud', 'wind', 'wind', 'wind']) {
    const mark = document.createElement('i');
    mark.className = `storm-atmosphere__${kind}`;
    layer.append(mark);
  }
  const label = document.createElement('p');
  label.className = 'storm-atmosphere__reading';
  const control = document.createElement('label');
  const toggle = document.createElement('input');
  toggle.type = 'checkbox';
  toggle.checked = true;
  control.append(toggle, ' Show decorative wind and clouds');
  host.append(control, label);
  viewport.append(layer);
  let state = atmosphereState();
  let destroyed = false;
  function paint() {
    layer.hidden = !state.available || !toggle.checked;
    layer.style.setProperty('--atmosphere-phase', state.phase);
    label.textContent = state.label;
  }
  toggle.addEventListener('change', paint);
  paint();
  return {
    render(step) {
      if (destroyed) return;
      state = atmosphereState(step);
      paint();
    },
    destroy() {
      destroyed = true;
      toggle.removeEventListener('change', paint);
      layer.remove();
      control.remove();
      label.remove();
    },
  };
}
