import { formatVariableValue, groupVariables } from "./assumption-inspector.js";

let mountId = 0;
const finite = (value) => (typeof value === "number" || typeof value === "string")
  && String(value).trim() !== "" && Number.isFinite(Number(value));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** Mount baseline controls. Overrides use the Assumption Inspector's { id: { baseline, min, max, locked } } shape.
 * setValues replaces overrides silently; user edits and resets emit a fresh snapshot immediately.
 */
export function mountLiveParameterControls(container, { experiment, overrides = {}, onChange } = {}) {
  if (!container?.replaceChildren) throw new Error("mountLiveParameterControls requires a container");
  const doc = container.ownerDocument || document;
  const prefix = `live-parameters-${++mountId}`;
  const rows = new Map();
  const listeners = [];
  let destroyed = false;
  let values = {};
  const variables = (Array.isArray(experiment?.worldModel?.variables) ? experiment.worldModel.variables : [])
    .filter((variable) => variable && typeof variable.id === "string" && variable.id.trim())
    .filter((variable, index, all) => all.findIndex((other) => other.id === variable.id) === index);
  const root = doc.createElement("div");
  root.className = "live-parameter-controls";
  container.replaceChildren(root);

  function listen(element, event, callback) {
    element.addEventListener(event, callback);
    listeners.push(() => element.removeEventListener(event, callback));
  }
  function emit() {
    if (typeof onChange === "function") {
      onChange(Object.fromEntries(Object.entries(values).map(([id, value]) => [id, { ...value }])));
    }
  }
  function sync(row) {
    const override = values[row.variable.id];
    const min = override?.min ?? row.min;
    const max = override?.max ?? row.max;
    const value = override?.baseline ?? row.baseline;
    for (const input of [row.range, row.number]) {
      input.min = String(min);
      input.max = String(max);
      input.value = String(value);
      input.removeAttribute("aria-invalid");
    }
    row.output.textContent = formatVariableValue(row.variable, value);
    row.reset.disabled = !override;
  }

  for (const group of groupVariables(variables)) {
    const section = doc.createElement("section");
    section.className = "assumption-group";
    const heading = doc.createElement("h3");
    heading.textContent = group.category.replace(/[-_]+/g, " ");
    section.appendChild(heading);
    for (const variable of group.variables) {
      const article = doc.createElement("article");
      article.className = "assumption-row live-parameter-row";
      article.dataset.variableId = variable.id;
      const label = variable.label || variable.id;
      const baseId = `${prefix}-${rows.size}`;
      const title = doc.createElement("label");
      title.htmlFor = `${baseId}-range`;
      title.textContent = label;
      const output = doc.createElement("output");
      output.setAttribute("for", `${baseId}-range ${baseId}-number`);
      const description = doc.createElement("p");
      description.id = `${baseId}-description`;
      description.className = "assumption-meta";
      description.textContent = [variable.description || variable.reason, `Unit: ${variable.unit || "index"}.`].filter(Boolean).join(" ");
      const numberLabel = doc.createElement("label");
      numberLabel.htmlFor = `${baseId}-number`;
      numberLabel.textContent = `${label} value (${variable.unit || "index"})`;
      const range = doc.createElement("input");
      range.type = "range";
      range.id = `${baseId}-range`;
      const number = doc.createElement("input");
      number.type = "number";
      number.id = `${baseId}-number`;
      const valid = finite(variable.baseline) && finite(variable.range?.min) && finite(variable.range?.max);
      const min = valid ? Math.min(Number(variable.range.min), Number(variable.range.max)) : 0;
      const max = valid ? Math.max(Number(variable.range.min), Number(variable.range.max)) : 1;
      const span = max - min;
      // Decimal steps keep catalog baselines aligned with the native range input's grid.
      const precision = Math.max(...[min, max, variable.baseline].filter(finite).map((value) => {
        const [mantissa, exponent = "0"] = String(value).toLowerCase().split("e");
        return Math.max(0, (mantissa.split(".")[1]?.length || 0) - Number(exponent));
      }));
      const inferredStep = span > 0 ? Math.min(10 ** Math.floor(Math.log10(span / 100)), 10 ** -precision) : 0.01;
      const step = finite(variable.step) && Number(variable.step) > 0 ? Number(variable.step) : inferredStep;
      for (const input of [range, number]) {
        input.step = String(step);
        input.disabled = !valid || min === max;
        input.setAttribute("aria-describedby", description.id);
      }
      if (!valid) description.textContent += " Parameter unavailable: a finite baseline and range are required.";
      const reset = doc.createElement("button");
      reset.type = "button";
      reset.textContent = "Reset";
      reset.setAttribute("aria-label", `Reset ${label}`);
      const row = { variable, range, number, output, reset, min, max, valid, baseline: valid ? clamp(Number(variable.baseline), min, max) : 0 };
      rows.set(variable.id, row);
      const edit = (input) => {
        if (destroyed || !row.valid || input.disabled) return;
        if (!finite(input.value)) {
          input.setAttribute("aria-invalid", "true");
          return;
        }
        const previous = values[variable.id];
        const low = previous?.min ?? min;
        const high = previous?.max ?? max;
        values[variable.id] = { ...previous, baseline: clamp(Number(input.value), low, high), min: low, max: high,
          locked: previous?.locked ?? Boolean(variable.locked), reason: "Adjusted in live simulation controls" };
        sync(row);
        emit();
      };
      listen(range, "input", () => edit(range));
      listen(number, "input", () => edit(number));
      listen(number, "blur", () => sync(row));
      listen(reset, "click", () => {
        if (destroyed) return;
        delete values[variable.id];
        sync(row);
        emit();
      });
      article.append(title, output, range, numberLabel, number, reset, description);
      section.appendChild(article);
    }
    root.appendChild(section);
  }
  if (!variables.length) {
    const message = doc.createElement("p");
    message.setAttribute("role", "status");
    message.textContent = "No simulation parameters are available for this experiment.";
    root.appendChild(message);
  }
  const resetAll = doc.createElement("button");
  resetAll.type = "button";
  resetAll.textContent = "Reset all parameters";
  resetAll.disabled = !variables.length;
  listen(resetAll, "click", () => {
    if (destroyed) return;
    values = {};
    for (const row of rows.values()) sync(row);
    emit();
  });
  root.appendChild(resetAll);

  function setValues(next = {}) {
    if (destroyed) return;
    values = {};
    for (const [id, row] of rows) {
      const raw = next?.[id];
      const candidate = typeof raw === "number" ? raw : raw?.baseline;
      if (row.valid && finite(candidate)) {
        const low = finite(raw?.min ?? raw?.range?.min) ? Number(raw.min ?? raw.range.min) : row.min;
        const high = finite(raw?.max ?? raw?.range?.max) ? Number(raw.max ?? raw.range.max) : row.max;
        const min = Math.min(low, high);
        const max = Math.max(low, high);
        values[id] = { baseline: clamp(Number(candidate), min, max), min, max,
          locked: typeof raw?.locked === "boolean" ? raw.locked : Boolean(row.variable.locked) };
      }
      sync(row);
    }
  }
  setValues(overrides);
  return {
    setValues,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const remove of listeners) remove();
      root.remove();
    },
  };
}
