import { hazardTile } from './hazard-field.js';

// A fixed depth datum, not terrain elevation or invented underground geometry.
export const CUTAWAY_MAX_METRES = 1;
export function depthProfile(frame) {
  const { size, selected, depth } = frame ?? {};
  if (!Number.isInteger(size) || size < 1 || size > 128 ||
      !Number.isInteger(selected) || selected < 0 || selected >= size * size) return [];
  const start = Math.floor(selected / size) * size;
  return Array.from({ length: size }, (_, column) => {
    const cell = start + column;
    const tile = hazardTile(depth, cell);
    return { ...tile, cell, column: column + 1, selected: cell === selected,
      height: tile.value === null ? null : Math.min(tile.value, CUTAWAY_MAX_METRES),
      overflow: tile.value !== null && tile.value > CUTAWAY_MAX_METRES };
  });
}

export function mountDepthCutaway(host, onCell) {
  const details = document.createElement('details');
  details.className = 'storm-cutaway';
  const summary = document.createElement('summary');
  summary.textContent = 'Water depth cutaway · selected grid row';
  const legend = document.createElement('p');
  legend.textContent = '2D vertical depth profile · fixed 0–1 m above local ground. Pale green = dry (0 m); light blue = >0 to <0.10 m; blue = 0.10 to <0.40 m; dark blue = ≥0.40 m. × = missing; ↑ = above 1 m, clipped visually only. Depth readings rounded to 0.001 m below each column. Synthetic modeled water, not a forecast; uncertainty unquantified. Ground line is schematic, not subsurface geology. Select a column or use Grid row and Grid column above.';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  const scale = document.createElement('p');
  scale.textContent = 'Vertical scale: top 1 m · bottom 0 m (local ground)';
  const profile = document.createElement('div');
  profile.className = 'storm-cutaway__profile';
  profile.setAttribute('role', 'group');
  profile.setAttribute('aria-label', 'Depth cutaway columns');
  details.append(summary, legend, status, scale, profile);
  host.append(details);
  let frame, destroyed = false;
  function draw() {
    if (destroyed || !details.open) return;
    const rows = depthProfile(frame);
    status.textContent = rows.length
      ? `Row ${Math.floor(frame.selected / frame.size) + 1} · ${frame.provenance ?? 'Provenance unavailable'}`
      : 'No supported depth row available.';
    // Reuse controls so timeline updates retain keyboard focus.
    if (profile.children.length !== rows.length) {
      profile.replaceChildren(...rows.map(() => {
        const button = document.createElement('button');
        button.type = 'button';
        const bar = document.createElement('span');
        bar.className = 'storm-cutaway__bar';
        bar.setAttribute('aria-hidden', 'true');
        const caption = document.createElement('span');
        button.append(bar, caption);
        button.onclick = () => onCell(Number(button.dataset.cell));
        return button;
      }));
    }
    rows.forEach((row, index) => {
      const button = profile.children[index];
      button.dataset.cell = row.cell;
      button.setAttribute('aria-pressed', String(row.selected));
      const value = row.value === null ? 'missing' : row.value > 0 && row.value < .0005 ? '<0.001 m' : `${row.value.toFixed(3)} m`;
      button.setAttribute('aria-label', `Column ${row.column}: ${value}${row.overflow ? ', above fixed scale' : ''}`);
      button.firstChild.style.setProperty('--depth-height', `${(row.height ?? 0) * 100}%`);
      button.firstChild.style.setProperty('--depth-color', row.color);
      button.firstChild.style.borderBottomColor = row.value === 0 || row.value === null ? row.color : '#a2b08d';
      button.firstChild.style.backgroundColor = row.value === null ? '#777777' : 'transparent';
      button.firstChild.textContent = row.value === null ? '×' : row.overflow ? '↑' : '';
      button.lastChild.textContent = `C${row.column} · ${value}`;
    });
  }
  details.addEventListener('toggle', draw);
  return {
    render(input) { if (!destroyed) { frame = input; draw(); } },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      frame = undefined;
      details.removeEventListener('toggle', draw);
      profile.replaceChildren();
      details.remove();
    },
  };
}
