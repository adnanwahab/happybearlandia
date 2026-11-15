// Presentation-only category illustrations. No model imports, snapshots or clocks.
export const PEEK_VERSION = 'authored-category-v1';
export const AUTHORED_AT = '2026-11-15';
export const MAX_PEEK_BYTES = 4096;
const palettes = {
  worlds: ['#153448', '#77c9b1'], living: ['#302848', '#dda3c4'],
  science: ['#172b45', '#8dbcf7'], games: ['#382d20', '#eac579'], tools: ['#183739', '#8cd1ce'],
};
export function staleLabel(now = Date.now()) {
  const age = now - Date.parse(AUTHORED_AT + 'T00:00:00Z');
  return !Number.isFinite(age) || age < 0 || age > 30 * 86400000
    ? 'Stale preview — current experience may differ.' : 'Current experience may differ.';
}
export function illustration(category) {
  const [background, ink] = palettes[category] || palettes.tools;
  // A schematic postcard, deliberately without quantities, entity IDs or outcomes.
  const shapes = category === 'living' || category === 'games'
    ? '<circle cx="120" cy="85" r="22"/><path d="M85 165v-30a35 35 0 0 1 70 0v30Z"/><circle cx="220" cy="100" r="18"/><path d="M190 165v-15a30 30 0 0 1 60 0v15Z"/>'
    : category === 'science' || category === 'tools'
    ? '<path d="M60 150 120 70 210 145 270 60" fill="none" stroke="currentColor" stroke-width="6"/><circle cx="120" cy="70" r="13"/><circle cx="210" cy="145" r="13"/>'
    : '<path d="M55 170V95h55v75Zm80 0V60h55v110Zm80 0v-55h65v55Z"/><path d="M40 185h255" stroke="currentColor" stroke-width="5"/>';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 330 222" style="background:${background};color:${ink}" fill="currentColor" role="img" aria-label="Authored category illustration; not a simulation snapshot">${shapes}</svg>`;
  if (new TextEncoder().encode(svg).byteLength > MAX_PEEK_BYTES) throw new Error('Preview byte cap exceeded');
  return svg;
}
export function mountPeek(viewport, experience, index) {
  const art = document.createElement('div');
  art.className = 'peek-art';
  art.innerHTML = illustration(experience.category);
  const details = document.createElement('div');
  details.className = 'peek-details';
  details.id = `peek-${index}`;
  details.hidden = true;
  const label = document.createElement('strong');
  label.textContent = 'Authored illustration · not a live simulation';
  const note = document.createElement('div');
  // Registry text remains plain text, never markup or executable content.
  note.textContent = `${experience.description || experience.title} ${PEEK_VERSION} · ${AUTHORED_AT}. ${staleLabel()}`;
  details.append(label, note);
  const caption = document.createElement('div');
  caption.className = 'peek-caption';
  caption.textContent = 'Authored category illustration · not live';
  viewport.append(art, caption, details);
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Preview';
  button.setAttribute('aria-label', `Preview ${experience.title}`);
  button.setAttribute('aria-controls', details.id);
  const setOpen = value => { details.hidden = !value; button.setAttribute('aria-expanded', String(value)); };
  setOpen(false);
  button.addEventListener('click', () => setOpen(true));
  return {button, open: () => setOpen(true), close: () => setOpen(false)};
}
