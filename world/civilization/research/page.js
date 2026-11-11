const form = document.querySelector('form');
const submit = form.querySelector('button');
const status = document.querySelector('#status');
const section = document.querySelector('#result');
const replay = document.querySelector('#replay');

function minutes(value) {
  return value === null ? 'Unavailable' : `${value.toFixed(2)} min`;
}

function showResult({ forecast, summary, participantId, startMonth, months, policy, samples,
  seed, plannerVersion, cityVersion, scenarioVersion, challenge }) {
  document.querySelector('#scope').textContent =
    `${participantId} · Month ${startMonth} to ${startMonth + months} · Seed ${seed} · ${policy.cost.toLocaleString()} modeled project cost · ${plannerVersion} / ${scenarioVersion} / ${cityVersion}`;
  const rows = [
    ['Without expansion', forecast.baseline, summary.meanBaseline],
    ['With expansion', forecast.intervention, summary.meanIntervention],
    ['Change with expansion', forecast.delta, summary.meanDelta],
  ];
  document.querySelector('#comparison').replaceChildren(...rows.map(([label, estimate, modeled]) => {
    const row = document.createElement('tr');
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.textContent = label;
    row.append(heading);
    for (const value of [estimate, modeled]) {
      const cell = document.createElement('td');
      cell.textContent = minutes(value);
      row.append(cell);
    }
    return row;
  }));
  document.querySelector('#coverage').textContent =
    `${summary.paired} of ${samples} pairs recorded a commute in both futures. ${summary.unpaired} pairs are excluded from commute averages.`;
  document.querySelector('#spread').textContent = summary.paired
    ? `Changes across comparable City pairs ranged from ${minutes(summary.minDelta)} to ${minutes(summary.maxDelta)}. The City mean change minus the planner’s forecast was ${minutes(summary.meanDelta - forecast.delta)}.`
    : 'No comparable commute outcomes are available.';
  document.querySelector('#inputs').replaceChildren(...forecast.evidence.map(link => {
    const item = document.createElement('li');
    item.textContent = `${link.id} · ${link.flow} trips, capacity ${link.capacity}, free-flow time ${minutes(link.freeTime)}${link.expands ? ' · receives the expansion' : ''}`;
    return item;
  }));
  replay.hidden = !challenge;
  if (challenge) replay.href = '/world/living-city/?' + new URLSearchParams({ challenge });
  section.hidden = false;
}

form.addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(form);
  const inputs = { seed: Number(data.get('seed')), amount: Number(data.get('amount')) };
  section.hidden = true;
  submit.disabled = true;
  status.textContent = 'Running 100 paired City simulations…';

  function finish(message) {
    status.textContent = message;
    submit.disabled = false;
  }
  try {
    const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.addEventListener('message', ({ data }) => {
      worker.terminate();
      if (data.error) {
        finish(data.error);
        return;
      }
      showResult(data.result);
      finish('Planner experiment complete.');
    }, { once: true });
    worker.addEventListener('error', () => {
      worker.terminate();
      finish('The City simulation worker could not run.');
    }, { once: true });
    worker.postMessage(inputs);
  } catch {
    finish('The City simulation worker could not start.');
  }
});
