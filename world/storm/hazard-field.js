// Rendering adapter only: never synthesizes water, drainage or uncertainty bounds.
export function hazardTile(values, cell, { sampled = false, uncertain = true } = {}) {
  const value = values?.[cell];
  const known = Number.isFinite(value) && value >= 0;
  return { value: known ? value : null, state: !known ? 'unknown' : sampled ? 'sampled estimate' : 'modeled value',
    uncertain: known && uncertain,
    color: !known ? '#777777' : value === 0 ? '#dae4cf' : value < .1 ? '#70c9d7' : value < .4 ? '#328db2' : '#22649e' };
}

export function paintHazard(context, { size, values, selected, sampled, uncertain = true }) {
  const tile = 14;
  for (let cell = 0; cell < size * size; cell++) {
    const x = cell % size * tile, y = Math.floor(cell / size) * tile;
    const row = hazardTile(values, cell, { sampled, uncertain });
    context.fillStyle = row.color;
    context.fillRect(x, y, tile, tile);
    context.strokeStyle = '#172d38';
    context.lineWidth = 1;
    if (row.state === 'unknown' || row.state === 'sampled estimate') {
      context.beginPath(); context.moveTo(x, y + tile); context.lineTo(x + tile, y);
      if (row.state === 'unknown') { context.moveTo(x, y); context.lineTo(x + tile, y + tile); }
      context.stroke();
    }
    if (row.uncertain) { context.fillStyle = '#172d38'; context.fillRect(x + 6, y + 6, 2, 2); }
    if (cell === selected) { context.strokeStyle = '#ffb000'; context.lineWidth = 3; context.strokeRect(x + 1.5, y + 1.5, tile - 3, tile - 3); }
  }
}

export function mountHazardField(host, onCell) {
  const label = document.createElement('label');
  label.textContent = 'Hazard field ';
  const picker = document.createElement('select');
  picker.setAttribute('aria-label', 'Hazard field');
  for (const [value, text] of [['depth', 'Water depth (m)'], ['drains', 'Drainage capacity (m per step)']]) {
    picker.add(new Option(text, value));
  }
  label.append(picker);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;max-width:100%;width:28rem;image-rendering:pixelated';
  canvas.setAttribute('aria-label', 'Hazard field grid; use Grid row and Grid column above to select a tile');
  const legend = document.createElement('p');
  legend.textContent = 'Source-value scale: pale green = 0; light blue = >0 to <0.10; blue = 0.10 to <0.40; dark blue = ≥0.40 (selected field units). Diagonal / = sampled estimate; gray × = unknown; dots = model uncertainty, unquantified. Synthetic assumptions, not observed flood probabilities. Drainage is capacity, not actual water removed.';
  const reading = document.createElement('p');
  reading.setAttribute('role', 'status');
  reading.id = 'hazard-reading';
  host.append(label, canvas, legend, reading);
  let frame;
  function draw() {
    if (!frame) return;
    const { size, selected, provenance } = frame;
    canvas.width = canvas.height = size * 14;
    const values = frame[picker.value];
    const tile = hazardTile(values, selected);
    const context = canvas.getContext('2d');
    if (context) paintHazard(context, { size, values, selected });
    const units = picker.value === 'depth' ? 'm' : 'm per step';
    reading.textContent = `${context ? '' : 'Canvas2D unavailable; selected tile reading only. '}${picker.selectedOptions[0].text} · row ${Math.floor(selected / size) + 1}, column ${selected % size + 1} · ${tile.state} · ${tile.value === null ? 'missing value' : tile.value.toFixed(3) + ' ' + units} · ${tile.uncertain ? 'Model uncertainty: unquantified' : 'Uncertainty unavailable'} · ${provenance}`;
  }
  picker.onchange = draw;
  canvas.onclick = event => {
    if (!frame) return;
    const box = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - box.left) / box.width * frame.size);
    const y = Math.floor((event.clientY - box.top) / box.height * frame.size);
    if (x >= 0 && y >= 0 && x < frame.size && y < frame.size) onCell(y * frame.size + x);
  };
  return { render(input) { frame = input; draw(); } };
}
