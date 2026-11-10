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
