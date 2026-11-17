// Presentation only: these metaphors make no claim about a resident's mood or skill.
export const LIFE_CAPTION_VERSION = 'house-life-captions.v1';
const templates = Object.freeze({
  clean: 'Cleaning finished. Dust has left the chat.',
  read: 'Reading finished. The plot can wait here.',
  rest: 'Rest finished. A small pause in the household epic.',
  music: 'Music time finished. The soundtrack takes a bow.',
});
export function lifeCaption(event, home, minute) {
  if (!event || typeof event.id !== 'string' || !event.id.trim() ||
      event.type !== 'HOUSEHOLD_ACTION_COMPLETED' || event.synthetic !== true ||
      event.schemaVersion !== 'event.v2' || !Number.isFinite(event.tick) || !event.modelVersion ||
      !home?.householdId || event.householdId !== home.householdId ||
      !Number.isFinite(event.minute) || !Number.isFinite(minute) || event.minute > minute ||
      !Number.isFinite(event.actualPersonMinutes) || event.actualPersonMinutes <= 0) return null;
  const text = templates[event.actionType];
  if (!text || !Array.isArray(home.completedActions)) return null;
  const action = home.completedActions.find(row => row.id === event.actionId);
  if (!action || action.type !== event.actionType || action.completedMinute !== event.minute) return null;
  return {version: LIFE_CAPTION_VERSION, eventId: event.id, actionId: action.id,
    minute: event.minute, label: 'Narrative color · synthetic household', text};
}

export function mountLifeCaptions(parent, getData) {
  const doc = parent.ownerDocument, section = doc.createElement('section');
  const label = doc.createElement('label'), toggle = doc.createElement('input');
  toggle.type = 'checkbox';
  label.append(toggle, ' Lighthearted captions');
  const output = doc.createElement('div');
  output.dataset.lifeCaptions = '';
  section.append(label, output); parent.prepend(section);
  function update() {
    output.replaceChildren();
    if (!toggle.checked) return;
    const data = getData();
    const captions = (data.events ?? data.journal ?? []).map(event => lifeCaption(event, data.home, data.minute)).filter(Boolean).slice(-2);
    if (!captions.length) { output.textContent = 'No supported completed actions with retained evidence yet.'; return; }
    for (const caption of captions) {
      const p = doc.createElement('p'), source = doc.createElement('small');
      p.textContent = caption.text;
      source.textContent = `${caption.label} · Event ${caption.eventId} · Minute ${caption.minute}`;
      p.append(doc.createElement('br'), source); output.append(p);
    }
  }
  toggle.addEventListener('change', update);
  return {update};
}
