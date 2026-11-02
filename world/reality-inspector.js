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
    timeline: Array.isArray(simulation?.timeline) ? simulation.timeline : [],
    events: Array.isArray(simulation?.events) ? simulation.events : [],
    explanation: simulation?.explanation || null,
    trace: simulation?.trace || [],
    adapter: simulation?.adapter || null,
    scenarioFamily: simulation?.world?.scenarioFamily || null,
    causalPathways: Array.isArray(simulation?.explanation?.causalPathways) ? simulation.explanation.causalPathways : [],
    feedbackLoops: Array.isArray(simulation?.explanation?.feedbackLoops) ? simulation.explanation.feedbackLoops : [],
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

  if (explanation.scenarioFamily) {
    const scenario = element("p", "notice");
    scenario.append(
      element("strong", "", `${explanation.scenarioFamily.label || explanation.scenarioFamily.id}: `),
      document.createTextNode(explanation.scenarioFamily.description || "Scenario family"),
    );
    container.appendChild(scenario);
  }

  const metrics = element("div", "metric-cards");
  for (const [name, value] of Object.entries(explanation.metrics)) {
    const card = element("div", "metric-card");
    card.append(element("strong", "", String(value)), element("span", "", name.replace(/([A-Z])/g, " $1")));
    metrics.appendChild(card);
  }
  container.appendChild(metrics);

  if (explanation.timeline.length) {
    container.appendChild(element("h3", "", "Year-by-year trajectory"));
    const table = element("table", "analysis-table");
    const headRow = document.createElement("tr");
    ["Year", "Score", "Rollout", "Delivery", "Political", "Resilience", "Events"].forEach((label) => headRow.appendChild(element("th", "", label)));
    const thead = document.createElement("thead");
    thead.appendChild(headRow);
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    const rows = explanation.timeline.length <= 12
      ? explanation.timeline
      : explanation.timeline.filter((_, index) => index === 0 || index === explanation.timeline.length - 1 || (index + 1) % Math.ceil(explanation.timeline.length / 10) === 0);
    for (const row of rows) {
      const tr = document.createElement("tr");
      tr.append(
        element("td", "", String(row.year ?? "—")),
        element("td", "", String(row.score ?? "—")),
        element("td", "", row.rollout == null ? "—" : `${(Number(row.rollout) * 100).toFixed(0)}%`),
        element("td", "", row.delivery == null ? "—" : `${(Number(row.delivery) * 100).toFixed(0)}%`),
        element("td", "", row.politicalDurability == null ? "—" : `${(Number(row.politicalDurability) * 100).toFixed(0)}%`),
        element("td", "", row.disruptionResilience == null ? "—" : `${(Number(row.disruptionResilience) * 100).toFixed(0)}%`),
        element("td", "", Array.isArray(row.events) && row.events.length ? row.events.join(", ") : "—"),
      );
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    container.appendChild(table);
  }

  if (explanation.causalPathways.length) {
    container.appendChild(element("h3", "", "Strongest causal pathways"));
    const pathList = element("div", "driver-list");
    for (const path of explanation.causalPathways) {
      const row = element("div", "driver-row");
      row.append(
        element("strong", "", path.description || (path.nodes || []).join(" → ")),
        element("span", "", `target: ${String(path.target || "system").replaceAll("_", " ")}`),
        element("span", "driver-delta", `${path.direction || "modeled"} · ${Number(path.effect || 0) >= 0 ? "+" : ""}${Number(path.effect || 0).toFixed(3)}`),
      );
      pathList.appendChild(row);
    }
    container.appendChild(pathList);
  }

  if (explanation.feedbackLoops.length) {
    container.appendChild(element("h3", "", "Feedback loops"));
    const loopList = element("div", "driver-list");
    for (const loop of explanation.feedbackLoops) {
      const row = element("div", "driver-row");
      row.append(
        element("strong", "", loop.label || loop.id),
        element("span", "", loop.description || loop.type || "feedback loop"),
        element("span", "driver-delta", `${loop.type || "loop"} · activity ${(Number(loop.activity || 0) * 100).toFixed(0)}%`),
      );
      loopList.appendChild(row);
    }
    container.appendChild(loopList);
  }

  if (explanation.events.length) {
    container.appendChild(element("h3", "", "Causal event log"));
    const eventList = element("div", "driver-list");
    for (const item of explanation.events.slice(0, 16)) {
      const row = element("div", "driver-row");
      row.append(
        element("strong", "", `Year ${item.year} · ${item.type}`),
        element("span", "", item.description || "Modeled event"),
        element("span", "driver-delta", `severity ${Number(item.severity || 0).toFixed(2)}`),
      );
      eventList.appendChild(row);
    }
    container.appendChild(eventList);
  }

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
