const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const signedCurrency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', signDisplay: 'exceptZero' });
const minutes = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const signedMinutes = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, signDisplay: 'exceptZero' });

const money = value => currency.format(value);
const time = value => `${minutes.format(value)} min`;
const unavailable = 'Unavailable';

function matched(baseline, adjusted) {
  return Number.isInteger(baseline?.month) && baseline.month === adjusted?.month &&
    Boolean(baseline.household?.id) && baseline.household.id === adjusted.household?.id;
}

export function mountHousehold(host) {
  if (!host?.ownerDocument) throw new TypeError('A household comparison container is required.');
  const doc = host.ownerDocument;

  function element(tag, text) {
    const node = doc.createElement(tag);
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function measure(value, formatter, fallback = unavailable) {
    if (!Number.isFinite(value)) return fallback;
    const node = element('data', formatter(value));
    node.value = String(value);
    return node;
  }

  function assignment({ unitId, buildingId }) {
    if (!unitId) return 'No assigned unit';
    const label = element('span', `Unit ${unitId}`);
    if (buildingId) label.append(' ', element('small', `Building ${buildingId}`));
    return label;
  }

  function move(household) {
    const { move, districtId, districtName } = household;
    if (!move) return 'No move recorded this month';
    const destination = move.destinationDistrict === districtId && districtName ? districtName : move.destinationDistrict;
    const node = element('span', `${move.originDistrict} → ${destination}`);
    const costs = element('small');
    costs.append(measure(move.previousCost, money), ' → ', measure(move.newCost, money), ' monthly rent');
    node.append(' ', costs);
    return node;
  }

  const panel = element('section');
  panel.className = 'hbl-household';
  const heading = element('h2', 'Household consequences');
  const context = element('p', 'Choose a simulation month to compare this household.');
  context.className = 'hbl-household-context';
  const scroll = element('div');
  scroll.className = 'hbl-household-scroll';
  scroll.tabIndex = 0;
  scroll.setAttribute('role', 'region');
  scroll.setAttribute('aria-label', 'Scrollable household comparison');
  scroll.hidden = true;

  const table = element('table');
  table.append(element('caption', 'Monthly City snapshots. Money values are modeled USD.'));
  const header = table.createTHead().insertRow();
  for (const label of ['Measure', 'Baseline', 'Adjusted', 'Adjusted minus baseline']) {
    const column = element('th', label);
    column.scope = 'col';
    header.append(column);
  }
  const body = table.createTBody();
  scroll.append(table);

  const chronology = element('p', 'The trip began before this month’s housing move. The City model resolves transport before housing.');
  chronology.className = 'hbl-household-context';
  chronology.hidden = true;
  panel.append(heading, context, scroll, chronology);
  host.append(panel);

  function row(label, baseline, adjusted, difference = '—') {
    const tr = element('tr');
    const title = element('th', label);
    title.scope = 'row';
    tr.append(title);
    for (const value of [baseline, adjusted, difference]) {
      const td = element('td');
      td.append(value);
      tr.append(td);
    }
    return tr;
  }

  function render(baseline, adjusted) {
    if (!matched(baseline, adjusted)) {
      context.textContent = 'A matched household snapshot is unavailable for this month.';
      scroll.hidden = true;
      chronology.hidden = true;
      body.replaceChildren();
      return;
    }
    const month = baseline.month;
    const a = baseline.household;
    const b = adjusted.household;
    const placement = value => Number.isInteger(value) ? `Month ${value}` : 'No placement recorded';
    const metric = (label, key, format, formatDelta, fallback = unavailable) => row(
      label, measure(a[key], format, fallback), measure(b[key], format, fallback),
      Number.isFinite(a[key]) && Number.isFinite(b[key]) ? measure(b[key] - a[key], formatDelta) : 'Unavailable',
    );

    context.textContent = `Household ${a.id} · Month ${month}`;
    body.replaceChildren(
      row('Assigned housing', assignment(a), assignment(b)),
      row('District at month end', a.districtName ?? a.districtId ?? unavailable, b.districtName ?? b.districtId ?? unavailable),
      row('First housing placement', placement(a.firstHousedMonth), placement(b.firstHousedMonth)),
      row('Recorded move', move(a), move(b)),
      metric('Monthly rent', 'rent', money, value => signedCurrency.format(value)),
      metric('Experienced commute', 'commuteMinutes', time, value => `${signedMinutes.format(value)} min`, 'No commute recorded'),
      row('Recorded commute origin', a.commuteOriginName ?? unavailable, b.commuteOriginName ?? unavailable),
      metric('Monthly income', 'income', money, value => signedCurrency.format(value)),
      metric('Savings at month end', 'savings', money, value => signedCurrency.format(value)),
    );
    chronology.hidden = ![a, b].some(({ move, commuteOriginName, districtName }) =>
      move && commuteOriginName && districtName && commuteOriginName !== districtName);
    scroll.hidden = false;
  }

  return { render, destroy: () => panel.remove() };
}
