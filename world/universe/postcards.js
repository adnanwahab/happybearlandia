import { getExperience } from './registry.js';
import { DEFAULT_RECIPE } from '../future-machine/contracts.js';
import { encodeRecipe } from '../future-machine/share/index.js';

// A catalog preset is a new synthetic experiment, never a captured world/run.
export function postcardScenario(id) {
  const app = getExperience(id);
  if (!app) return { reason: 'Unknown postcard. Choose a workspace in this directory.' };
  if (id !== 'future-machine') return { reason: `${app.title} has no validated experiment preset or snapshot adapter. Open the workspace to explore it directly.` };
  return {
    href: `/world/future-machine.html?fm=${encodeRecipe(DEFAULT_RECIPE)}&month=0&renderer=canvas2d`,
    label: 'Synthetic Riverside housing preset · seed 42 · 120 months · 24 proposed homes · illustrative $1,000,000 cost. Starts a new experiment; no saved world is imported.',
  };
}

export function mountPostcards(host, target, navigate = href => location.assign(href)) {
  const doc = host.ownerDocument;
  target.querySelector('h2').textContent = 'New Experiment';
  const hint = target.querySelector('p');
  hint.id = 'postcard-help';
  hint.textContent = 'Drop a workspace postcard here, or use its New Experiment button. Only validated presets can open.';
  const status = doc.createElement('p');
  status.id = 'postcard-status'; status.setAttribute('role', 'status');
  status.tabIndex = -1;
  target.append(status);
  let dragging = null;
  const clear = () => { dragging = null; target.removeAttribute('data-dragging'); };
  const open = id => {
    const scenario = postcardScenario(id);
    if (scenario.href) navigate(scenario.href);
    else { status.textContent = scenario.reason; status.focus(); }
  };
  for (const card of host.querySelectorAll('article')) {
    const id = card.dataset.experienceId;
    const scenario = postcardScenario(id);
    card.draggable = true;
    const preview = doc.createElement('p');
    preview.className = 'postcard-preset';
    preview.textContent = scenario.label || 'Experiment preset unavailable';
    const button = doc.createElement('button');
    button.type = 'button'; button.className = 'postcard-action';
    button.textContent = 'New Experiment';
    button.setAttribute('aria-label', `New Experiment from ${getExperience(id).title}`);
    button.setAttribute('aria-describedby', 'postcard-help');
    button.addEventListener('click', () => open(id));
    card.append(preview, button);
    card.addEventListener('dragstart', event => {
      // Nested links/buttons retain their own native interaction.
      if (event.target !== card) { event.preventDefault(); return; }
      dragging = id;
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('application/x-hbl-postcard', id);
      target.setAttribute('data-dragging', 'true');
      status.textContent = scenario.reason || 'Release on New Experiment to open the synthetic preset.';
    });
    card.addEventListener('dragend', clear);
  }
  target.addEventListener('dragover', event => {
    if (!dragging) return;
    event.preventDefault(); event.dataTransfer.dropEffect = 'copy';
  });
  target.addEventListener('drop', event => {
    event.preventDefault();
    const id = dragging;
    clear();
    // Ignore external, stale and forged payloads, including ordinary URLs.
    if (id && event.dataTransfer.getData('application/x-hbl-postcard') === id) open(id);
  });
  doc.addEventListener('keydown', event => { if (event.key === 'Escape') clear(); });
}
