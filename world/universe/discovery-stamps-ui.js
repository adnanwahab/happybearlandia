import {STAMPS, createStampBook} from './discovery-stamps.js';
let storage;
try { storage = window.localStorage; } catch {}
const book = createStampBook(storage);
const style = document.createElement('link');
style.rel = 'stylesheet'; style.href = '/world/universe/discovery-stamps.css';
document.head.append(style);
const album = document.querySelector('[data-stamp-album]');
const id = document.querySelector('[data-discovery-stamp]')?.dataset.discoveryStamp;
const stamp = STAMPS.find(item => item.id === id);
if (album || stamp) {
  const panel = document.createElement('details');
  panel.className = 'discovery-stamps';
  if (album) panel.open = true;
  const summary = document.createElement('summary');
  summary.textContent = album ? 'Your discovery stamps' : 'A small discovery';
  const note = document.createElement('p');
  note.textContent = 'Optional cosmetic stamps, saved only in this browser. No deadlines, streaks or paid rewards.';
  const status = document.createElement('p'); status.setAttribute('role', 'status');
  const list = document.createElement('div');
  const controls = [];
  for (const item of album ? STAMPS : [stamp]) {
    const row = document.createElement('p');
    if (album) {
      const link = document.createElement('a'); link.href = item.route; link.textContent = item.hint;
      row.append(link, ' ');
    }
    const label = document.createElement('span'); row.append(label);
    if (!album) {
      const button = document.createElement('button'); button.type = 'button';
      button.addEventListener('click', () => { book.collect(item.id); render(); });
      row.append(button); controls.push({item, label, button});
    } else controls.push({item, label});
    list.append(row);
  }
  const reset = document.createElement('button'); reset.type = 'button'; reset.textContent = 'Reset stamp progress';
  reset.addEventListener('click', () => { book.reset(); render(true); });
  const home = document.createElement('a'); home.href = '/routes'; home.textContent = 'Open stamp collection';
  panel.append(summary, note, list, reset, status);
  if (!album) panel.append(home);
  (album || document.querySelector('[data-discovery-stamp]')).append(panel);
  function render(wasReset = false) {
    for (const {item, label, button} of controls) {
      const found = book.has(item.id);
      label.textContent = `${item.name}: ${found ? 'discovered' : 'not yet discovered'}. `;
      if (button) { button.textContent = found ? 'Stamp collected' : `Collect ${item.name}`; button.disabled = found; }
    }
    status.textContent = (wasReset ? 'Progress reset. ' : '') + (book.persistent ? 'Progress stays on this browser only.' : 'Storage unavailable: changes last only on this page. Previously saved progress may return on reload.');
  }
  render();
}
