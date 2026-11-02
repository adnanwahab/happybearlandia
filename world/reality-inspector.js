function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(finite(value) * factor) / factor;
}

function variableMap(experiment) {
  return new Map((experiment?.worldModel?.variables || []).map((variable) => [variable.id, variable]));
}

export function explainReality(simulation, experiment, options = {}) {
  const limit = Math.max(1, Math.round(finite(options.limit, 8)));
  const definitions = variableMap(experiment);
  const conditions = simulation?.world?.conditions || {};
  const drivers = [];

  for (const [id, value] of Object.entries(conditions)) {
    const variable = definitions.get(id) || { id, label: id, range: { min: 0, max: 1 }, baseline: 0.5 };
    const min = finite(variable.range?.min, 0);
    const max = finite(variable.range?.max, 1);
    const baseline = finite(variable.baseline, (min + max) / 2);
    const span = max - min;
    const deviation = span > 0 ? (finite(value) - baseline) / span : 0;
    drivers.push({
      id,
      label: variable.label || id,
      category: variable.category || "custom",
      value: round(value),
      baseline: round(baseline),
      normalizedDeviation: round(deviation),
      direction: deviation > 0.02 ? "above-baseline" : deviation < -0.02 ? "below-baseline" : "near-baseline",
      reason: variable.reason || null,
      source: variable.source || null,
      unit: variable.unit || null,
    });
  }

  drivers.sort((a, b) => Math.abs(b.normalizedDeviation) - Math.abs(a.normalizedDeviation));
  return {
    worldId: simulation?.worldId || simulation?.world?.id || null,
    score: simulation?.score ?? null,
    status: simulation?.status || "unknown",
    metrics: simulation?.metrics || {},
    trace: simulation?.trace || [],
    adapter: simulation?.adapter || null,
    topDrivers: drivers.slice(0, limit),
    allDrivers: drivers,
  };
}

export function compareRealities(a, b, experiment, options = {}) {
  const limit = Math.max(1, Math.round(finite(options.limit, 10)));
  const definitions = variableMap(experiment);
  const ids = [...new Set([
    ...Object.keys(a?.world?.conditions || {}),
    ...Object.keys(b?.world?.conditions || {}),
  ])];
  const differences = ids.map((id) => {
    const av = finite(a?.world?.conditions?.[id]);
    const bv = finite(b?.world?.conditions?.[id]);
    const variable = definitions.get(id) || { id, label: id, range: { min: 0, max: 1 } };
    const span = finite(variable.range?.max, 1) - finite(variable.range?.min, 0);
    return {
      id,
      label: variable.label || id,
      a: round(av),
      b: round(bv),
      delta: round(bv - av),
      normalizedDelta: span > 0 ? round((bv - av) / span) : 0,
    };
  }).sort((x, y) => Math.abs(y.normalizedDelta) - Math.abs(x.normalizedDelta));

  return {
    a: { worldId: a?.worldId, score: a?.score, status: a?.status },
    b: { worldId: b?.worldId, score: b?.score, status: b?.status },
    scoreDelta: round(finite(b?.score) - finite(a?.score)),
    largestConditionChanges: differences.slice(0, limit),
  };
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function renderRealityInspector(container, simulation, experiment) {
  if (!container) throw new Error("renderRealityInspector requires a container");
  container.replaceChildren();
  if (!simulation) {
    container.appendChild(element("p", "notice", "Select a reality in the landscape."));
    return null;
  }

  const explanation = explainReality(simulation, experiment);
  const head = element("div", "reality-head");
  head.append(
    element("strong", "", explanation.worldId || "Reality"),
    element("span", `status-pill ${explanation.status}`, `${explanation.status} · score ${explanation.score}`),
  );
  container.appendChild(head);

  const metrics = element("div", "metric-cards");
  for (const [name, value] of Object.entries(explanation.metrics)) {
    const card = element("div", "metric-card");
    card.append(element("strong", "", String(value)), element("span", "", name.replace(/([A-Z])/g, " $1")));
    metrics.appendChild(card);
  }
  container.appendChild(metrics);

  container.appendChild(element("h3", "", "Largest world deviations"));
  const table = element("div", "driver-list");
  for (const driver of explanation.topDrivers) {
    const row = element("div", "driver-row");
    const magnitude = `${driver.normalizedDeviation >= 0 ? "+" : ""}${(driver.normalizedDeviation * 100).toFixed(1)}% of range`;
    row.append(
      element("strong", "", driver.label),
      element("span", "", `${driver.value} vs baseline ${driver.baseline}`),
      element("span", "driver-delta", magnitude),
    );
    table.appendChild(row);
  }
  container.appendChild(table);
  return explanation;
}

export const __test = { round, variableMap };
