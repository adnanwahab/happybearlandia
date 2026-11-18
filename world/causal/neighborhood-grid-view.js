/** Fixture-only presentation prototype. No City authority, geography inference or simulation. */
export const GRID_VIEW_LIMITS = Object.freeze({ metrics: 12, cells: 256, axis: 16 });
export function normalizeGridFixture(input) {
  if (input?.source !== "fixture")
    throw TypeError("This prototype accepts explicitly labeled fixture data only");
  if (!Array.isArray(input.metrics) || !input.metrics.length || input.metrics.length > 12 || !Array.isArray(input.cells) || input.cells.length > 256)
    throw RangeError("Use 1\u201312 metrics and at most 256 fixture cells");
  const ids = new Set, positions = new Set, metricIds = new Set, metrics = input.metrics.map((m) => {
    if (typeof m.id !== "string" || !m.id || m.id.length > 80 || metricIds.has(m.id) || typeof m.label !== "string" || !m.label || m.label.length > 120 || typeof m.unit !== "string" || !m.unit || m.unit.length > 80 || ![m.min, m.max].every(Number.isFinite) || m.min >= m.max)
      throw TypeError("Metrics need unique IDs, labels, units and finite increasing scale bounds");
    metricIds.add(m.id);
    return { ...m };
  }), cells = input.cells.map((c) => {
    if (typeof c.id !== "string" || !c.id || c.id.length > 120 || ids.has(c.id) || ![c.row, c.column].every((n) => Number.isInteger(n) && n >= 0 && n < 16) || positions.has(`${c.row}:${c.column}`))
      throw TypeError("Fixture cells require unique IDs and positions in a 16\xD716 bound");
    ids.add(c.id);
    positions.add(`${c.row}:${c.column}`);
    const values = Object.create(null);
    for (const m of metrics) {
      const raw = c.values?.[m.id], value = typeof raw?.value === "number" && Number.isFinite(raw.value) ? raw.value : null;
      values[m.id] = { value, reason: value === null ? String(raw?.reason || "No supported value supplied").slice(0, 200) : null, source: String(raw?.source || "Explicit synthetic fixture").slice(0, 200) };
    }
    return { id: c.id, row: c.row, column: c.column, values };
  });
  return { source: "fixture", metrics, cells: cells.sort((a, b) => a.row - b.row || a.column - b.column), columns: Math.max(1, ...cells.map((c) => c.column + 1)), rows: Math.max(1, ...cells.map((c) => c.row + 1)) };
}
export function gridCellLabel(cell, metric) {
  const reading = cell.values[metric.id];
  return `${cell.id}: ${reading.value === null ? `unavailable (${reading.reason})` : `${reading.value} ${metric.unit}`} \xB7 ${reading.source}`;
}
export function gridCellColor(value, metric) {
  if (value === null)
    return null;
  const t = Math.max(0, Math.min(1, (value - metric.min) / (metric.max - metric.min)));
  return `hsl(${Math.round(210 - t * 65)} 45% ${Math.round(25 + t * 40)}%)`;
}
export function createNeighborhoodGridView(container, { onSelect } = {}) {
  const doc = container.ownerDocument, root = doc.createElement("section");
  root.className = "neighborhood-grid-view";
  root.setAttribute("aria-label", "Neighborhood grid fixture prototype");
  const notice = doc.createElement("p");
  notice.textContent = "Synthetic fixture only \xB7 not connected to City data \xB7 cells are schematic, not geographic neighborhoods.";
  const label = doc.createElement("label");
  label.textContent = "Fixture metric ";
  const select = doc.createElement("select");
  label.append(select);
  const legend = doc.createElement("p"), viewport = doc.createElement("div"), surface = doc.createElement("div"), canvas = doc.createElement("canvas"), grid = doc.createElement("div"), detail = doc.createElement("p");
  viewport.className = "neighborhood-grid-viewport";
  surface.className = "neighborhood-grid-surface";
  grid.className = "neighborhood-grid-cells";
  grid.setAttribute("role", "group");
  grid.setAttribute("aria-label", "Fixture cells");
  canvas.setAttribute("aria-hidden", "true");
  detail.setAttribute("role", "status");
  detail.setAttribute("aria-live", "polite");
  surface.append(canvas, grid);
  viewport.append(surface);
  root.append(notice, label, legend, viewport, detail);
  container.append(root);
  let ctx;
  try {
    ctx = canvas.getContext("2d");
  } catch (error) {
    root.remove();
    throw error;
  }
  let data = null, metricId = null, selectedId = null, disposed = !1;
  const listeners = [], listen = (el, event, callback) => {
    el.addEventListener(event, callback);
    listeners.push(() => el.removeEventListener(event, callback));
  };
  function currentMetric() {
    return data?.metrics.find((m) => m.id === metricId);
  }
  function draw() {
    if (disposed || !data)
      return;
    const metric = currentMetric(), size = 64;
    canvas.width = data.columns * size;
    canvas.height = data.rows * size;
    surface.style.width = `${data.columns * size}px`;
    surface.style.height = `${data.rows * size}px`;
    grid.style.gridTemplateColumns = `repeat(${data.columns}, ${size}px)`;
    grid.style.gridTemplateRows = `repeat(${data.rows}, ${size}px)`;
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    for (const cell of data.cells) {
      const x = cell.column * size, y = cell.row * size, color = gridCellColor(cell.values[metricId].value, metric);
      if (!ctx)
        continue;
      ctx.fillStyle = color || "#22303a";
      ctx.fillRect(x, y, size, size);
      if (color === null) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, size, size);
        ctx.clip();
        ctx.strokeStyle = "#a8b2bb";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let d = -size;d < size; d += 10) {
          ctx.moveTo(x + d, y);
          ctx.lineTo(x + d + size, y + size);
        }
        ctx.stroke();
        ctx.restore();
      }
      ctx.strokeStyle = selectedId === cell.id ? "#ffe69a" : "#8aa1ae";
      ctx.lineWidth = selectedId === cell.id ? 4 : 1;
      ctx.strokeRect(x + 2, y + 2, size - 4, size - 4);
    }
    legend.textContent = `${metric.label} \xB7 ${metric.unit} \xB7 fixed scale ${metric.min} to ${metric.max} \xB7 hatched / ? = unavailable; 0 is a valid value.`;
    const selected = data.cells.find((c) => c.id === selectedId);
    detail.textContent = selected ? gridCellLabel(selected, metric) : "Select a fixture cell to inspect its value and source.";
    for (const button of grid.querySelectorAll("button")) {
      const cell = data.cells.find((c) => c.id === button.dataset.cellId);
      button.setAttribute("aria-label", gridCellLabel(cell, metric));
      button.setAttribute("aria-pressed", String(cell.id === selectedId));
      button.textContent = cell.values[metricId].value === null ? "?" : String(cell.values[metricId].value);
      button.style.backgroundImage = !ctx && cell.values[metricId].value === null ? "repeating-linear-gradient(135deg,transparent 0 7px,#a8b2bb 8px 9px)" : "none";
      button.style.backgroundColor = ctx ? "transparent" : gridCellColor(cell.values[metricId].value, metric) || "#22303a";
    }
  }
  function choose(id, { focus = !1, notify = !0 } = {}) {
    const cell = data?.cells.find((c) => c.id === id);
    if (!cell)
      return !1;
    selectedId = id;
    for (const b of grid.querySelectorAll("button")) {
      b.tabIndex = b.dataset.cellId === id ? 0 : -1;
      if (focus && b.tabIndex === 0)
        b.focus();
    }
    draw();
    if (notify)
      onSelect?.({ cellId: id, metricId, ...cell.values[metricId], dataSource: "fixture" });
    return !0;
  }
  listen(select, "change", () => {
    metricId = select.value;
    draw();
  });
  listen(grid, "click", (e) => {
    const button = e.target.closest("button[data-cell-id]");
    if (button && grid.contains(button))
      choose(button.dataset.cellId);
  });
  listen(grid, "keydown", (e) => {
    const cell = data?.cells.find((c) => c.id === e.target.dataset.cellId);
    if (!cell)
      return;
    let next;
    const moves = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] };
    if (moves[e.key]) {
      const [r, c] = moves[e.key];
      next = data.cells.find((n) => n.row === cell.row + r && n.column === cell.column + c);
    } else if (e.key === "Home")
      next = data.cells[0];
    else if (e.key === "End")
      next = data.cells.at(-1);
    else
      return;
    e.preventDefault();
    if (next)
      choose(next.id, { focus: !0 });
  });
  return { update(input) {
    if (disposed)
      return;
    data = normalizeGridFixture(input);
    metricId = data.metrics.some((m) => m.id === metricId) ? metricId : data.metrics[0].id;
    select.replaceChildren(...data.metrics.map((m) => {
      const option = doc.createElement("option");
      option.value = m.id;
      option.textContent = `${m.label} (${m.unit})`;
      return option;
    }));
    select.value = metricId;
    grid.replaceChildren(...data.cells.map((c) => {
      const b = doc.createElement("button");
      b.type = "button";
      b.dataset.cellId = c.id;
      b.style.gridRow = String(c.row + 1);
      b.style.gridColumn = String(c.column + 1);
      b.tabIndex = -1;
      return b;
    }));
    selectedId = data.cells.some((c) => c.id === selectedId) ? selectedId : data.cells[0]?.id ?? null;
    if (selectedId)
      choose(selectedId, { notify: !1 });
    else
      draw();
  }, setMetric(id) {
    if (!data?.metrics.some((m) => m.id === id))
      return !1;
    metricId = id;
    select.value = id;
    draw();
    return !0;
  }, focusCell(id) {
    return !disposed && choose(id, { focus: !0, notify: !1 });
  }, getStats() {
    return { source: "fixture", backend: ctx ? "canvas2d" : "dom", cells: disposed ? 0 : data?.cells.length ?? 0, metricId, selectedId, animationFrames: 0, disposed };
  }, dispose() {
    if (disposed)
      return;
    disposed = !0;
    listeners.forEach((remove) => remove());
    data = null;
    canvas.width = 0;
    canvas.height = 0;
    root.remove();
  } };
}
