const CATEGORY_ORDER = [
  "implementation",
  "government",
  "timing",
  "economy",
  "finance",
  "demographics",
  "construction",
  "labor",
  "geography",
  "infrastructure",
  "politics",
  "behavior",
  "technology",
  "social",
  "information",
  "environment",
  "shocks",
  "custom",
];

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function decimalsFor(variable) {
  const span = Math.abs(Number(variable?.range?.max) - Number(variable?.range?.min));
  if (span <= 0.02) return 4;
  if (span <= 0.2) return 3;
  if (span <= 2) return 2;
  if (span <= 20) return 1;
  return 0;
}

function stepFor(variable) {
  const min = Number(variable?.range?.min);
  const max = Number(variable?.range?.max);
  const span = Math.abs(max - min);
  if (!Number.isFinite(span) || span === 0) return 0.01;
  const raw = span / 100;
  if (raw >= 1) return Math.max(1, Math.round(raw));
  if (raw >= 0.1) return Number(raw.toFixed(1));
  if (raw >= 0.01) return Number(raw.toFixed(2));
  return Number(raw.toPrecision(1));
}

export function groupVariables(variables = []) {
  const grouped = new Map();
  for (const variable of variables) {
    const category = variable?.category || "custom";
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category).push(variable);
  }

  const orderIndex = new Map(CATEGORY_ORDER.map((category, index) => [category, index]));
  return [...grouped.entries()]
    .sort(([a], [b]) => {
      const ai = orderIndex.has(a) ? orderIndex.get(a) : CATEGORY_ORDER.length;
      const bi = orderIndex.has(b) ? orderIndex.get(b) : CATEGORY_ORDER.length;
      return ai - bi || a.localeCompare(b);
    })
    .map(([category, rows]) => ({
      category,
      variables: [...rows].sort((a, b) => String(a.label || a.id).localeCompare(String(b.label || b.id))),
    }));
}

export function createInspectorState(variables = []) {
  return Object.fromEntries(variables.map((variable) => [variable.id, {
    baseline: Number(variable.baseline),
    min: Number(variable.range?.min),
    max: Number(variable.range?.max),
    locked: Boolean(variable.locked),
    dirty: false,
  }]));
}

export function updateInspectorState(state, variable, patch) {
  const previous = state?.[variable.id] || {
    baseline: Number(variable.baseline),
    min: Number(variable.range?.min),
    max: Number(variable.range?.max),
    locked: Boolean(variable.locked),
  };

  let min = isFiniteNumber(patch.min) ? Number(patch.min) : previous.min;
  let max = isFiniteNumber(patch.max) ? Number(patch.max) : previous.max;
  if (min > max) [min, max] = [max, min];
  const baselineCandidate = isFiniteNumber(patch.baseline) ? Number(patch.baseline) : previous.baseline;
  const baseline = clamp(baselineCandidate, min, max);

  return {
    ...state,
    [variable.id]: {
      baseline,
      min,
      max,
      locked: typeof patch.locked === "boolean" ? patch.locked : previous.locked,
      dirty: true,
    },
  };
}

export function buildParameterOverrides(variables = [], state = {}) {
  const overrides = {};
  for (const variable of variables) {
    const current = state[variable.id];
    if (!current?.dirty) continue;
    overrides[variable.id] = {
      baseline: current.baseline,
      min: current.min,
      max: current.max,
      locked: current.locked,
      reason: "Reviewed in the HBL Assumption Inspector",
    };
  }
  return overrides;
}

export function formatVariableValue(variable, value) {
  if (!Number.isFinite(Number(value))) return "—";
  const number = Number(value);
  const digits = decimalsFor(variable);
  const unit = String(variable?.unit || "");
  if (unit === "fraction" || unit === "probability/year" || unit === "fraction/year") {
    return `${(number * 100).toFixed(Math.max(0, digits - 1))}%${unit.endsWith("/year") ? "/yr" : ""}`;
  }
  if (unit === "months") return `${number.toFixed(digits)} mo`;
  return `${number.toFixed(digits)}${unit && unit !== "index" ? ` ${unit}` : ""}`;
}

export function renderAssumptionInspector(container, variables = [], options = {}) {
  if (!container) throw new Error("renderAssumptionInspector requires a container");
  let state = options.state || createInspectorState(variables);
  const onChange = typeof options.onChange === "function" ? options.onChange : () => {};

  container.replaceChildren();
  const groups = groupVariables(variables);

  for (const group of groups) {
    const section = document.createElement("section");
    section.className = "assumption-group";
    const heading = document.createElement("h3");
    heading.textContent = group.category.replace(/[-_]+/g, " ");
    section.appendChild(heading);

    for (const variable of group.variables) {
      const row = document.createElement("article");
      row.className = "assumption-row";
      row.dataset.variableId = variable.id;

      const head = document.createElement("div");
      head.className = "assumption-head";
      const title = document.createElement("strong");
      title.textContent = variable.label || variable.id;
      const value = document.createElement("output");
      value.textContent = formatVariableValue(variable, state[variable.id]?.baseline);
      const provenance = document.createElement("span");
      provenance.className = "assumption-provenance";
      const provenanceType = variable.provenance?.type || (variable.source === "user-override" ? "user-override" : "heuristic");
      const provenanceGlyph = { observed: "●", estimated: "◐", heuristic: "○", "user-override": "✎", unknown: "?" }[provenanceType] || "?";
      provenance.textContent = `${provenanceGlyph} ${provenanceType}`;
      provenance.title = `${Math.round(Number(variable.provenance?.confidence ?? variable.confidence ?? 0) * 100)}% provenance confidence${variable.provenance?.geography ? ` · ${variable.provenance.geography}` : ""}`;
      head.append(title, provenance, value);

      const input = document.createElement("input");
      input.type = "range";
      input.min = String(variable.range?.min ?? 0);
      input.max = String(variable.range?.max ?? 1);
      input.step = String(stepFor(variable));
      input.value = String(state[variable.id]?.baseline ?? variable.baseline ?? 0);
      input.disabled = Boolean(state[variable.id]?.locked);

      const meta = document.createElement("div");
      meta.className = "assumption-meta";
      const reason = document.createElement("span");
      reason.textContent = variable.reason || "Modeling assumption";
      const lockLabel = document.createElement("label");
      lockLabel.className = "lock-toggle";
      const lock = document.createElement("input");
      lock.type = "checkbox";
      lock.checked = Boolean(state[variable.id]?.locked);
      lockLabel.append(lock, document.createTextNode(" lock"));
      meta.append(reason, lockLabel);

      input.addEventListener("input", () => {
        state = updateInspectorState(state, variable, { baseline: input.value });
        value.textContent = formatVariableValue(variable, state[variable.id].baseline);
        onChange(state, buildParameterOverrides(variables, state));
      });

      lock.addEventListener("change", () => {
        state = updateInspectorState(state, variable, { locked: lock.checked });
        input.disabled = lock.checked;
        onChange(state, buildParameterOverrides(variables, state));
      });

      row.append(head, input, meta);
      section.appendChild(row);
    }
    container.appendChild(section);
  }

  return {
    getState: () => state,
    getOverrides: () => buildParameterOverrides(variables, state),
  };
}

export const __test = { CATEGORY_ORDER, stepFor, clamp };
