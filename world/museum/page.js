import { key, readExhibits } from './store.js';
const gallery = document.querySelector('#gallery'), rooms = document.querySelector('#rooms'), status = document.querySelector('#status');
function render() {
  gallery.replaceChildren(); rooms.replaceChildren();
  try {
    const rows = readExhibits(localStorage);
    status.textContent = rows.length ? `${rows.length} local exhibit(s).` : 'No saved exhibits. Run a comparison and choose Save to museum.';
    rows.forEach((row, index) => {
      const section = document.createElement('section'); section.id = `room-${index}`;
      const heading = document.createElement('h2'); heading.textContent = `Room ${index + 1} · ${row.unavailable ? 'Receipt unavailable' : 'Your transit experiment'}`;
      section.append(heading);
      const nav = document.createElement('a'); nav.href = '#' + section.id; nav.textContent = `Room ${index + 1}`; rooms.append(nav);
      if (row.unavailable) {
        const missing = document.createElement('p'); missing.textContent = 'Original receipt unavailable or incompatible. No result or replay can be verified.'; section.append(missing);
      } else {
        const description = document.createElement('p'); description.textContent = 'Original saved receipt · synthetic computed model effects. Expand to inspect assumptions, versions, pair seeds, policy and measured outcomes.';
        const details = document.createElement('details'), summary = document.createElement('summary'), pre = document.createElement('pre');
        summary.textContent = 'Open original receipt'; pre.textContent = JSON.stringify(row.receipt, null, 2); details.append(summary, pre);
        const link = document.createElement('a'); link.href = '/world/laboratory/receipts/?' + new URLSearchParams({ challenge: row.recipe }); link.textContent = 'Recompute exact recipe and selected pair';
        section.append(description, details, link);
      }
      gallery.append(section);
    });
  } catch { status.textContent = 'Local museum storage unavailable or damaged. No exhibits can be verified. You can try deleting museum data.'; }
}
document.querySelector('#delete').addEventListener('click', () => {
  try { localStorage.removeItem(key); render(); } catch { status.textContent = 'Deletion unavailable: browser storage is blocked.'; }
});
window.addEventListener('storage', render);
render();
