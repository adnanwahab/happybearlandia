function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function dot(a, b) {
  let total = 0;
  for (let index = 0; index < Math.min(a.length, b.length); index++) total += a[index] * b[index];
  return total;
}

function norm(vector) {
  return Math.sqrt(dot(vector, vector));
}

function normalizeVector(vector) {
  const length = norm(vector) || 1;
  return vector.map((value) => value / length);
}

function multiply(matrix, vector) {
  return matrix.map((row) => dot(row, vector));
}

function powerIteration(matrix, initial, orthogonalTo = null, iterations = 60) {
  let vector = normalizeVector(initial);
  for (let step = 0; step < iterations; step++) {
    let next = multiply(matrix, vector);
    if (orthogonalTo) {
      const projection = dot(next, orthogonalTo);
      next = next.map((value, index) => value - projection * orthogonalTo[index]);
    }
    const length = norm(next);
    if (length < 1e-12) break;
    vector = next.map((value) => value / length);
  }
  return vector;
}

function covariance(matrix) {
  const rows = matrix.length;
  const columns = matrix[0]?.length || 0;
  const result = Array.from({ length: columns }, () => Array(columns).fill(0));
  if (rows < 2) return result;
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < columns; i++) {
      for (let j = i; j < columns; j++) result[i][j] += matrix[r][i] * matrix[r][j];
    }
  }
  for (let i = 0; i < columns; i++) {
    for (let j = i; j < columns; j++) {
      result[i][j] /= rows - 1;
      result[j][i] = result[i][j];
    }
  }
  return result;
}

function standardize(rows) {
  const columns = rows[0]?.length || 0;
  const means = Array(columns).fill(0);
  const stddevs = Array(columns).fill(1);
  if (!rows.length) return { matrix: [], means, stddevs };

  for (const row of rows) for (let c = 0; c < columns; c++) means[c] += row[c] / rows.length;
  for (let c = 0; c < columns; c++) {
    let variance = 0;
    for (const row of rows) variance += (row[c] - means[c]) ** 2;
    stddevs[c] = Math.sqrt(variance / Math.max(1, rows.length - 1)) || 1;
  }
  return {
    matrix: rows.map((row) => row.map((value, c) => (value - means[c]) / stddevs[c])),
    means,
    stddevs,
  };
}

function scaleAxis(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (!Number.isFinite(min) || max <= min) return values.map((_value, index) => values.length <= 1 ? 0 : -1 + (index / (values.length - 1)) * 2);
  const center = (min + max) / 2;
  const half = (max - min) / 2;
  return values.map((value) => (value - center) / half);
}

export function projectOutcomeLandscape(simulations = []) {
  if (!simulations.length) return { method: "pca-lite-v1", variableIds: [], points: [] };
  const variableIds = [...new Set(simulations.flatMap((row) => Object.keys(row?.world?.conditions || {})))].sort();
  const featureIds = [...variableIds, "__outcome_score"];
  const rows = simulations.map((simulation) => [
    ...variableIds.map((id) => finite(simulation.world?.conditions?.[id])),
    finite(simulation.score),
  ]);
  const { matrix } = standardize(rows);
  const dimensions = featureIds.length;

  if (!dimensions) {
    return { method: "pca-lite-v1", variableIds, points: simulations.map((simulation, index) => ({ simulation, x: index, y: 0 })) };
  }

  const cov = covariance(matrix);
  const initial1 = Array.from({ length: dimensions }, (_value, index) => 1 + (index % 3) * 0.1);
  const first = powerIteration(cov, initial1);
  const initial2 = Array.from({ length: dimensions }, (_value, index) => index % 2 ? -1 : 1);
  const second = dimensions > 1 ? powerIteration(cov, initial2, first) : Array(dimensions).fill(0);
  const xs = matrix.map((row) => dot(row, first));
  const ys = matrix.map((row) => dimensions > 1 ? dot(row, second) : 0);
  const sx = scaleAxis(xs);
  const sy = scaleAxis(ys);

  return {
    method: "pca-lite-v1",
    variableIds,
    featureIds,
    points: simulations.map((simulation, index) => ({
      id: simulation.worldId,
      x: sx[index],
      y: sy[index],
      score: simulation.score,
      status: simulation.status,
      simulation,
    })),
  };
}

export function renderOutcomeLandscape(svg, projection, options = {}) {
  if (!svg) throw new Error("renderOutcomeLandscape requires an SVG element");
  const width = finite(options.width, svg.clientWidth || 900);
  const height = finite(options.height, 520);
  const padding = finite(options.padding, 28);
  const onSelect = typeof options.onSelect === "function" ? options.onSelect : () => {};
  const namespace = "http://www.w3.org/2000/svg";
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.replaceChildren();

  const background = document.createElementNS(namespace, "rect");
  background.setAttribute("x", "0"); background.setAttribute("y", "0");
  background.setAttribute("width", String(width)); background.setAttribute("height", String(height));
  background.setAttribute("class", "landscape-bg");
  svg.appendChild(background);

  for (const point of projection?.points || []) {
    const circle = document.createElementNS(namespace, "circle");
    const x = padding + ((point.x + 1) / 2) * (width - padding * 2);
    const y = padding + ((1 - (point.y + 1) / 2)) * (height - padding * 2);
    circle.setAttribute("cx", String(x));
    circle.setAttribute("cy", String(y));
    circle.setAttribute("r", point.status === "negative" ? "4.6" : "3.8");
    circle.setAttribute("class", `landscape-point ${point.status || "unknown"}`);
    circle.setAttribute("tabindex", "0");
    circle.setAttribute("role", "button");
    circle.setAttribute("aria-label", `${point.id}: score ${point.score}`);
    const title = document.createElementNS(namespace, "title");
    title.textContent = `${point.id} · score ${point.score} · ${point.status}`;
    circle.appendChild(title);
    circle.addEventListener("click", () => onSelect(point));
    circle.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") onSelect(point);
    });
    svg.appendChild(circle);
  }
  return svg;
}

export const __test = { dot, norm, covariance, standardize, powerIteration, scaleAxis };
