import { createDemoEvidence } from './demo-evidence.js';
const input = document.querySelector('input'), status = document.querySelector('[role=status]'), section = document.querySelector('section');
let card = null, generation = 0;
input.addEventListener('change', async () => {
  const current = ++generation;
  card = null; section.hidden = true;
  const file = input.files[0];
  if (!file) { status.textContent = 'No receipt loaded. Counts, benchmark outcome and device are unavailable.'; return; }
  status.textContent = 'Validating receipt and replaying events…';
  try {
    if (file.size > 4_000_000) throw new Error('Receipt exceeds 4 MB');
    const next = createDemoEvidence(JSON.parse(await file.text()));
    if (current !== generation) return;
    card = next;
    document.querySelector('[data-summary]').textContent = card.summary;
    document.querySelector('[data-details]').textContent = JSON.stringify(card, null, 2);
    section.hidden = false;
    status.textContent = 'Receipt replay matched. Million-resident claim unverified. Human review pending.';
  } catch (error) {
    if (current === generation) status.textContent = `Evidence unavailable: ${error.message}`;
  }
});
document.querySelector('button').addEventListener('click', () => {
  if (!card) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(card, null, 2)], {type:'application/json'}));
  const link = document.createElement('a'); link.href = url; link.download = 'resident-demo-evidence.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
