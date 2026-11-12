import { AGENT_COUNT, NETWORKS, ROUND_COUNT, mindURL, readMindURL, runCollectiveMind } from './model.js';
import { mountNetworkView, networkLayout, OPTION_COLORS } from './render.js';

const byId = id => document.getElementById(id);
const form = byId('settings');
const host = byId('network');
const playback = byId('play');
const slider = byId('round');
const showEdges = byId('edges');
const status = byId('status');
const ratio = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 });
const render = mountNetworkView(host, name => { byId('backend').textContent = name; });

const optionRows = OPTION_COLORS.map(color => {
  const row = document.createElement('li');
  const label = document.createElement('div');
  label.className = 'option-label';
  const name = document.createElement('span');
  const value = document.createElement('strong');
  label.append(name, value);
  const track = document.createElement('div');
  track.className = 'option-track';
  track.setAttribute('aria-hidden', 'true');
  const fill = document.createElement('span');
  fill.className = 'option-fill';
  fill.style.setProperty('--option-color', color);
  track.append(fill);
  row.append(label, track);
  byId('options').append(row);
  return { name, value, fill };
});

for (const [key, text] of Object.entries(NETWORKS)) form.elements.network.append(new Option(text, key));
slider.max = ROUND_COUNT;

let run;
let layout;
let round = 0;
let timer;

function setRound(value) {
  round = value;
  slider.value = value;
  byId('round-output').value = `${round} of ${ROUND_COUNT}`;
  const { counts, agreement, changed, leadingShare } = run.stats[value];
  byId('agreement').textContent = ratio.format(agreement);
  byId('leading').textContent = ratio.format(leadingShare);
  byId('changed').textContent = String(changed);
  for (const [index, count] of counts.entries()) {
    const row = optionRows[index];
    row.value.textContent = `${count} · ${ratio.format(count / AGENT_COUNT)}`;
    row.fill.style.width = `${count / AGENT_COUNT * 100}%`;
  }
  host.setAttribute('aria-label', `Agent network at round ${round} · ${ratio.format(agreement)} of links agree`);
  render.draw(layout(run.frames[value], showEdges.checked));
}

function share() {
  history.replaceState(null, '', mindURL(run.recipe, round));
}

function stop() {
  clearInterval(timer);
  timer = null;
  playback.textContent = 'Play';
}

function reset(input, initialRound = 0) {
  const next = runCollectiveMind(input);
  stop();
  run = next;
  layout = networkLayout(run);
  const { question, options, network, seed, openness } = run.recipe;
  byId('question-heading').textContent = question;
  for (const [i, row] of optionRows.entries()) row.name.textContent = options[i];
  for (const [name, value] of Object.entries({ question, network, seed, openness: Number((openness * 100).toPrecision(12)), a: options[0], b: options[1], c: options[2] })) {
    form.elements[name].value = value;
  }
  setRound(initialRound);
}

form.addEventListener('submit', event => {
  event.preventDefault();
  const { seed, network, question, openness, a, b, c } = Object.fromEntries(new FormData(form));
  try {
    reset({ seed: Number(seed), network, question, openness: Number(openness) / 100, options: [a, b, c] });
    status.textContent = `${NETWORKS[network]} · Seed ${run.recipe.seed} · ${run.edges.length.toLocaleString('en-US')} communication links.`;
    share();
  } catch (error) {
    status.textContent = error.message;
  }
});

slider.addEventListener('input', () => {
  stop();
  setRound(Number(slider.value));
  share();
});
showEdges.addEventListener('change', () => setRound(round));
playback.addEventListener('click', () => {
  if (timer) {
    stop();
    share();
    return;
  }
  if (round === ROUND_COUNT) setRound(0);
  playback.textContent = 'Pause';
  timer = setInterval(() => {
    setRound(round + 1);
    if (round === ROUND_COUNT) {
      stop();
      share();
    }
  }, 160);
});

try {
  const request = readMindURL(location.search);
  reset(request.recipe, request.round);
} catch (error) {
  reset();
  status.textContent = error.message;
}
