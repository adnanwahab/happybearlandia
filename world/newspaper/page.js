import { createDesk, reviewPage, FLAVOR } from './editor.js';
import { loadArchive } from './editions.js';

const status = document.querySelector('#status');
const archive = document.querySelector('#archive');
const picker = document.querySelector('#editions');
const stories = document.querySelector('#stories');
const template = document.querySelector('#story');
const retry = document.querySelector('#retry');
const recordDemo = document.querySelector('#record-demo');

function renderEdition(edition) {
  document.querySelector('#edition-title').textContent = `Simulation year ${edition.year}`;
  const articles = edition.stories.map(({ event, desk, headline, copy, district, href }) => {
    const fragment = template.content.cloneNode(true);
    const byline = [desk, `Month ${event.context.tick}`, district && `District ${district}`].filter(Boolean);
    fragment.querySelector('.byline').textContent = byline.join(' · ');
    fragment.querySelector('h3').textContent = headline;
    fragment.querySelector('.copy').textContent = copy;
    fragment.querySelector('.record-link').href = href;
    fragment.querySelector('.month-link').href = '/world/causal.html?' + new URLSearchParams({
      runId: event.context.runId, month: event.context.tick, event: event.id,
    });
    fragment.querySelector('.kind').textContent = event.provenance.kind;
    fragment.querySelector('.origin').textContent = event.provenance.source;
    fragment.querySelector('.model').textContent = event.provenance.modelVersion;
    fragment.querySelector('.event-id').textContent = event.id;
    return fragment;
  });
  if (!articles.length) {
    const empty = document.createElement('p');
    empty.textContent = 'No recorded events matched the newspaper’s story topics for this edition.';
    articles.push(empty);
  }
  stories.replaceChildren(...articles);
}

async function openArchive() {
  retry.hidden = true;
  recordDemo.hidden = true;
  status.hidden = false;
  status.textContent = 'Looking for the recorded demo…';
  try {
    const { state, run, editions } = await loadArchive();
    if (state === 'missing') {
      status.textContent = 'No edition yet. The monthly city demo has no saved run here.';
      recordDemo.hidden = false;
      return;
    }
    if (state === 'incomplete') {
      status.textContent = 'No edition yet. The saved simulation run is incomplete.';
      return;
    }
    if (!editions.length) {
      status.textContent = 'No edition yet. The completed run contains no recorded events.';
      return;
    }

    picker.replaceChildren(...editions.map(({ year }) => new Option(`Year ${year}`, year)));
    picker.onchange = () => renderEdition(editions[picker.selectedIndex]);
    document.querySelector('#source').textContent =
      `Selected events from the simulated city · Seed ${run.context.seed} · ${run.context.modelVersion}`;
    renderEdition(editions[0]);
    status.hidden = true;
    archive.hidden = false;
  } catch {
    status.textContent = 'The recorded archive could not be loaded.';
    retry.hidden = false;
  }
}

retry.addEventListener('click', openArchive);
openArchive();

let desk = null;
let generation = 0;
const editor = document.querySelector('#editor');
const reviewStatus = document.querySelector('#review-status');
const shareLabel = document.querySelector('#share-label');
function clearShare() { shareLabel.hidden = true; document.querySelector('#share-page').value = ''; }
document.querySelector('#open-editor').onclick = async () => {
  const request = ++generation;
  clearShare();
  editor.hidden = true;
  reviewStatus.textContent = 'Reading pinned source records…';
  try {
    const next = createDesk(await loadArchive());
    if (request !== generation) return;
    desk = next;
    if (!desk?.stories.length) { reviewStatus.textContent = 'No source data. Open the monthly causal demo to record the pinned run.'; return; }
    document.querySelector('#candidates').replaceChildren(...desk.stories.map(story => {
      const row = document.createElement('fieldset');
      const legend = document.createElement('legend');
      legend.textContent = story.headline;
      row.append(legend);
      const choose = document.createElement('label');
      const box = document.createElement('input'); box.type = 'checkbox'; box.value = story.event.id;
      choose.append(box, ' Choose headline'); row.append(choose);
      const fact = document.createElement('p'); fact.textContent = story.copy; row.append(fact);
      const link = document.createElement('a'); link.href = story.href; link.textContent = 'Inspect immutable event and provenance'; row.append(link);
      for (const [name, title, options] of [
        ['treatment', 'Headline treatment', [['record', 'Report the recorded result'], ['prediction', 'This guarantees a better future']]],
        ['label', FLAVOR, [['', 'Label this phrase…'], ['fact', 'Sourced fact'], ['interpretation', 'Interpretation / scripted flavor']]],
      ]) {
        const label = document.createElement('label'); label.textContent = title + ' ';
        const select = document.createElement('select'); select.name = name;
        for (const [value, text] of options) select.add(new Option(text, value));
        label.append(select); row.append(label);
      }
      return row;
    }));
    editor.hidden = false;
    reviewStatus.textContent = 'Choose exactly 3. Every selected phrase needs an editorial label.';
  } catch { if (request === generation) reviewStatus.textContent = 'Source records unavailable. Try again.'; }
};
editor.onchange = () => { ++generation; clearShare(); reviewStatus.textContent = 'Draft changed. Review again before sharing.'; };
document.querySelector('#cancel-editor').onclick = () => {
  ++generation; desk = null; editor.reset(); editor.hidden = true; clearShare(); reviewStatus.textContent = 'Edition cancelled. Source records unchanged.';
};
editor.onsubmit = async event => {
  event.preventDefault(); clearShare();
  const request = ++generation;
  const selections = [...document.querySelectorAll('#candidates fieldset')].filter(row => row.querySelector('input').checked).map(row => ({
    id: row.querySelector('input').value, treatment: row.querySelector('[name=treatment]').value, label: row.querySelector('[name=label]').value,
  }));
  try {
    const current = createDesk(await loadArchive());
    if (request !== generation) return;
    const result = reviewPage(desk, selections, current);
    reviewStatus.textContent = result.ok ? 'Review passed: 3 sourced headlines. Ready to copy.' : result.errors.join(' ');
    if (result.ok) {
      document.querySelector('#share-page').value = JSON.stringify(result.page, null, 2);
      shareLabel.hidden = false;
    }
  } catch { if (request === generation) reviewStatus.textContent = 'Review failed: source records unavailable.'; }
};
