export const OBSERVATORY_VERSION = 'city-observatory.v1';
export const SENSOR_BUDGET = 100;
export const SENSOR_METRICS = Object.freeze({
  meanCommuteMinutes: Object.freeze({ label: 'Mean commute time', unit: 'minutes', cost: 40, resolution: 1 }),
  commuteCount: Object.freeze({ label: 'Completed commute count', unit: 'trips', cost: 20, exact: true, resolution: 1 }),
  housingUnits: Object.freeze({ label: 'Housing stock', unit: 'units', cost: 25, exact: true, resolution: 1 }),
  meanRent: Object.freeze({ label: 'Mean rent', unit: 'modeled USD/month', cost: 35, resolution: 25 }),
  unhoused: Object.freeze({ label: 'Unhoused households', unit: 'households', cost: 30, exact: true, resolution: 1 }),
});

const maxSensors = Math.floor(SENSOR_BUDGET / Math.min(...Object.values(SENSOR_METRICS).map(metric => metric.cost)));
const key = ({ districtId, metric }) => JSON.stringify([districtId, metric]);
const cost = sensors => sensors.reduce((total, sensor) => total + SENSOR_METRICS[sensor.metric].cost, 0);

function districtCatalog(baseline) {
  const districts = new Map();
  for (const row of baseline.series) {
    for (const district of row.districts ?? []) {
      if (!districts.has(district.id)) districts.set(district.id, district.name ?? district.id);
    }
  }
  return districts;
}

export function normalizeSensors(sensors, baseline) {
  if (!Array.isArray(sensors) || sensors.length > maxSensors) {
    throw new Error('The sensor placement exceeds the Observatory budget or is invalid.');
  }
  const districts = baseline ? districtCatalog(baseline) : null;
  const unique = new Set();
  const normalized = [];
  for (const sensor of sensors) {
    const { districtId, metric } = sensor ?? {};
    if (typeof districtId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(districtId) ||
        (districts && !districts.has(districtId))) throw new Error('Choose a supported district.');
    if (typeof metric !== 'string' || !Object.hasOwn(SENSOR_METRICS, metric)) throw new Error('Choose a supported district metric.');
    const entry = { districtId, metric };
    const identity = key(entry);
    if (unique.has(identity)) throw new Error('This district already has that sensor.');
    unique.add(identity);
    normalized.push(entry);
  }
  if (cost(normalized) > SENSOR_BUDGET) throw new Error('The sensor placement exceeds the Observatory budget.');
  return normalized;
}

export function measureSensors(baseline, sensors) {
  if (!Array.isArray(baseline?.series)) throw new Error('The Observatory needs retained monthly City snapshots.');
  const placement = normalizeSensors(sensors, baseline);
  return baseline.series.flatMap(row => placement.map(({ districtId, metric }) => {
    const district = row.districts?.find(candidate => candidate.id === districtId);
    const { unit, resolution, exact } = SENSOR_METRICS[metric];
    const raw = district?.[metric];
    const present = Number.isFinite(raw) && raw >= 0 && (!exact || Number.isSafeInteger(raw));
    const value = present ? (exact ? raw : Math.round(raw / resolution) * resolution) : null;
    const halfStep = exact ? 0 : resolution / 2;
    return {
      month: row.month,
      districtId,
      metric,
      unit,
      value,
      uncertainty: present ? {
        kind: exact ? 'exact-snapshot-count' : 'rounding-bound',
        resolution,
        lower: Math.max(0, value - halfStep),
        upper: value + halfStep,
      } : null,
      status: present ? 'measured' : 'unavailable',
      reason: present ? null : !district ? 'District snapshot unavailable'
        : metric === 'meanCommuteMinutes' && district.commuteCount === 0
          ? 'No modeled commutes in this district and month' : 'Metric unavailable in this snapshot',
      provenance: {
        kind: 'simulated-snapshot',
        modelVersion: baseline.recipe?.modelVersion,
        scenarioVersion: baseline.scenarioVersion,
        seed: baseline.recipe?.seed,
        sensorVersion: OBSERVATORY_VERSION,
      },
    };
  }));
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

let nextFieldId = 0;
function labeled(label, input) {
  const wrapper = element('div', null, 'city-observatory__field');
  const caption = element('label', label);
  input.id = `observatory-field-${++nextFieldId}`;
  caption.htmlFor = input.id;
  wrapper.append(caption, input);
  return wrapper;
}

export function mountObservatory(host, { onChange }) {
  const panel = element('div', null, 'city-observatory');
  const form = element('form');
  const districtSelect = element('select');
  const metricSelect = element('select');
  metricSelect.replaceChildren(...Object.entries(SENSOR_METRICS).map(([metric, { label, cost }]) =>
    new Option(`${label} · ${cost} credits`, metric)));
  const add = element('button', 'Add sensor');
  add.type = 'submit';
  form.append(labeled('District', districtSelect), labeled('Sensor metric', metricSelect), add);

  const budget = element('p', null, 'city-observatory__budget');
  const status = element('p', null, 'city-observatory__status');
  status.setAttribute('role', 'status');
  const month = element('select');
  const monthLabel = labeled('Observation month', month);
  const readings = element('div', null, 'city-observatory__readings');
  const source = element('p', null, 'city-observatory__source');
  panel.append(budget, form, status, monthLabel, readings, source);
  host.append(panel);

  let active = [];
  let districts = new Map();
  let byMonth = new Map();
  let selectedMonth;
  let available = false;
  let locked = false;
  const format = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

  function selectedSensor() {
    return { districtId: districtSelect.value, metric: metricSelect.value };
  }

  function updateControls() {
    const choice = selectedSensor();
    const duplicate = active.some(sensor => key(sensor) === key(choice));
    const remaining = SENSOR_BUDGET - cost(active);
    const price = SENSOR_METRICS[choice.metric]?.cost ?? Infinity;
    budget.textContent = `${remaining} of ${SENSOR_BUDGET} sensor credits available`;
    districtSelect.disabled = !available || locked;
    metricSelect.disabled = !available || locked;
    add.disabled = !available || locked || duplicate || price > remaining;
    status.textContent = !available ? 'Run a baseline to place sensors.'
      : locked ? 'Sensor placements are locked for this approved experiment.'
      : duplicate ? 'A sensor already measures that metric in this district.'
        : price > remaining ? 'This sensor costs more than the available credits.' : '';
  }

  function paintReadings() {
    const rows = byMonth.get(selectedMonth) ?? [];
    const cards = rows.map(record => {
      const { label, cost, exact, resolution } = SENSOR_METRICS[record.metric];
      const district = districts.get(record.districtId);
      const card = element('article');
      const title = element('h3', `${district} · ${label}`);
      const value = record.status === 'measured'
        ? `${format.format(record.value)} ${record.unit}` : 'Unavailable';
      let detail = record.reason;
      if (record.uncertainty) {
        const { lower, upper } = record.uncertainty;
        detail = exact ? 'Exact count in the model snapshot'
          : `${format.format(resolution)} ${record.unit} resolution · rounding interval ${format.format(lower)}–${format.format(upper)}`;
      }
      const remove = element('button', 'Remove');
      remove.type = 'button';
      remove.disabled = locked;
      remove.setAttribute('aria-label', `Remove ${label.toLowerCase()} sensor in ${district}`);
      remove.onclick = () => {
        onChange(active.filter(sensor => key(sensor) !== key(record)));
        districtSelect.focus();
      };
      card.append(title, element('strong', value), element('p', detail), element('p', `${cost} credits`), remove);
      return card;
    });
    if (available && !cards.length) cards.push(element('p', 'Add a sensor to see its monthly readings.'));
    readings.replaceChildren(...cards);
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!add.disabled) onChange([...active, selectedSensor()]);
  });
  districtSelect.addEventListener('change', updateControls);
  metricSelect.addEventListener('change', updateControls);
  month.addEventListener('change', () => {
    selectedMonth = Number(month.value);
    paintReadings();
  });

  return {
    render({ baseline, sensors = [], locked: nextLocked = false }) {
      locked = nextLocked;
      const oldDistrict = districtSelect.value;
      active = normalizeSensors(sensors, baseline);
      districts = baseline ? districtCatalog(baseline) : new Map();
      available = districts.size > 0;
      districtSelect.replaceChildren(...[...districts].map(([id, name]) => new Option(name, id)));
      if (districts.has(oldDistrict)) districtSelect.value = oldDistrict;
      const months = baseline?.series.map(row => row.month) ?? [];
      byMonth = new Map(months.map(tick => [tick, []]));
      for (const record of baseline ? measureSensors(baseline, active) : []) byMonth.get(record.month).push(record);
      if (!byMonth.has(selectedMonth)) selectedMonth = months.at(-1);
      month.replaceChildren(...months.map(tick => new Option(`Month ${tick}`, tick)));
      month.value = selectedMonth ?? '';
      monthLabel.hidden = !available;
      source.textContent = available
        ? `Simulated City snapshots · Seed ${baseline.recipe.seed} · ${baseline.recipe.modelVersion} · ${OBSERVATORY_VERSION}`
        : '';
      updateControls();
      paintReadings();
    },
    destroy() {
      panel.remove();
    },
  };
}
