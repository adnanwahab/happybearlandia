import { createHarness, DEMO_URL } from './core.js';
const root = document.querySelector('#onboarding-experiment');
const link = document.querySelector('.flagship-demo');
let harness, session;
try {
  harness = createHarness({ storage: sessionStorage, enabled: root.dataset.enabled === 'true' });
  session = harness.read();
} catch { root.hidden = true; }
if (harness) {
  const consent = root.querySelector('input');
  const choices = root.querySelector('[data-choices]');
  const status = root.querySelector('[role=status]');
  const download = root.querySelector('[data-export]');
  root.hidden = root.dataset.enabled !== 'true';
  function render() {
    consent.checked = !!session;
    download.hidden = !session;
    choices.hidden = session?.variant !== 'policy';
    status.textContent = session ? 'Participating. Session records stay in this tab; uncheck to erase them.' : '';
    // The assigned experience is rendered and recorded at the same point in both arms,
    // before any start or policy choice. Reloads do not add another exposure.
    if (session) harness.record('exposure');
  }
  function fallback() { session = null; try { harness.withdraw(); } catch {} root.hidden = true; }
  try { render(); } catch { fallback(); }
  if (root.dataset.enabled !== 'true') root.hidden = true;
  consent.addEventListener('change', () => {
    try { session = consent.checked ? harness.consent() : (harness.withdraw(), null); render(); }
    catch { fallback(); }
  });
  link.addEventListener('click', event => {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (session?.variant === 'policy') { event.preventDefault(); choices.querySelector('button').focus(); }
    else try { harness.record('start'); } catch { fallback(); }
  });
  for (const button of choices.querySelectorAll('button')) button.addEventListener('click', () => {
    try { harness.record('choice', button.dataset.focus); harness.record('start'); } catch { fallback(); }
    location.assign(DEMO_URL);
  });
}

if (harness) root.querySelector('[data-export]').addEventListener('click', () => {
  const record = harness.read();
  if (!record) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'onboarding-session.json'; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
