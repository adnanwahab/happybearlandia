const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});
const percentage = new Intl.NumberFormat('en-US', {
  style: 'percent',
  maximumFractionDigits: 2,
});

const metrics = {
  rent: {
    label: 'Mean rental-unit rent',
    unit: 'Illustrative USD per month',
    source: 'units',
    sample: unit => unit.tenure === 'rental' ? unit.rent : null,
    thresholds: [1000, 1250, 1500, 2000],
    format: value => money.format(value),
  },
  income: {
    label: 'Mean household income',
    unit: 'Illustrative USD per month',
    source: 'households',
    sample: household => household.income,
    thresholds: [3000, 4500, 6000, 7500],
    format: value => money.format(value),
  },
  occupancy: {
    label: 'Occupied share of all housing units',
    unit: 'Percent of units',
    source: 'units',
    sample: unit => Number(unit.status === 'occupied'),
    thresholds: [.25, .5, .75, .9],
    format: value => percentage.format(value),
  },
};

export function districtHeatmap(state, metricId) {
  const metric = metrics[metricId];
  const totals = new Map(state.districts.map(({ id }) => [id, { sum: 0, count: 0 }]));
  for (const row of state[metric.source]) {
    const total = totals.get(row.districtId);
    const sample = metric.sample(row);
    if (!total || !Number.isFinite(sample)) continue;
    total.sum += sample;
    total.count++;
  }
  return state.districts.map(({ id, name }) => {
    const { sum, count } = totals.get(id);
    const value = count ? sum / count : null;
    const bin = value === null ? 'missing' : metric.thresholds.filter(threshold => value >= threshold).length;
    return { id, name: name ?? id, value, bin, count };
  });
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function swatch(bin) {
  const key = element('span', 'city-heatmap__swatch');
  key.dataset.bin = bin;
  key.setAttribute('aria-hidden', 'true');
  return key;
}

export function mountCityHeatmap(host) {
  host.classList.add('city-heatmap');
  const heading = element('h2', 'city-heatmap__heading', 'District heatmap');
  const label = element('label', 'city-heatmap__control', 'Metric');
  const picker = element('select', 'city-heatmap__picker');
  for (const [id, metric] of Object.entries(metrics)) picker.add(new Option(metric.label, id));
  label.append(picker);
  const unit = element('p', 'city-heatmap__unit');
  const districts = element('ul', 'city-heatmap__districts');
  districts.setAttribute('aria-label', 'District values');
  const legend = element('ul', 'city-heatmap__legend');
  legend.setAttribute('aria-label', 'Heatmap legend');
  host.replaceChildren(heading, label, unit, districts, legend);

  let state;
  function render() {
    if (!state) {
      host.hidden = true;
      districts.replaceChildren();
      legend.replaceChildren();
      return;
    }
    const metric = metrics[picker.value];
    unit.textContent = metric.unit;
    districts.replaceChildren(...districtHeatmap(state, picker.value).map(row => {
      const item = element('li', 'city-heatmap__district');
      item.append(
        swatch(row.bin),
        element('strong', 'city-heatmap__name', row.name),
        element('span', 'city-heatmap__value', row.value === null ? 'No data' : metric.format(row.value)),
      );
      return item;
    }));
    const thresholds = metric.thresholds.map(metric.format);
    const labels = [
      `Below ${thresholds[0]}`,
      ...thresholds.slice(1).map((upper, index) => `${thresholds[index]} to below ${upper}`),
      `${thresholds.at(-1)} or higher`,
      'No data',
    ];
    legend.replaceChildren(...labels.map((text, index) => {
      const item = element('li', 'city-heatmap__key');
      item.append(swatch(index === labels.length - 1 ? 'missing' : index), text);
      return item;
    }));
    host.hidden = false;
  }

  picker.addEventListener('change', render);
  render();
  return checkpoint => {
    state = checkpoint;
    render();
  };
}
