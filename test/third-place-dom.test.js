import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';

// Optional DOM integration uses the real page module; browser layout is separate.
test.skipIf(!process.env.HBL_DOM_MODULE)('normal-entry link, confirm/cancel and replay failure preserve published design', async () => {
  const { Window } = await import(process.env.HBL_DOM_MODULE);
  const window = new Window();
  const previous = globalThis.document;
  try {
    const entry = readFileSync(new URL('../world/invention/index.html', import.meta.url), 'utf8');
    expect(entry).toContain('href="/world/invention/third-place/"');
    window.document.write(readFileSync(new URL('../world/invention/third-place/index.html', import.meta.url), 'utf8'));
    globalThis.document = window.document;
    await import('../world/invention/third-place/page.js');
    const el = id => window.document.getElementById(id);
    const confirm = () => el('design').dispatchEvent(new window.Event('submit', { cancelable: true }));
    confirm();
    const receipt = el('receipt').value, after = el('checkpoint').textContent;
    expect(el('status').textContent).toContain('challenge passed');
    expect(after).toContain('66000');
    el('project').value = 'plaza'; el('cancel').click();
    expect(el('receipt').value).toBe(receipt);
    expect(el('checkpoint').textContent).toBe(after);
    el('before').click(); expect(el('lot').textContent).toContain('Empty lot');
    el('after').click(); expect(el('checkpoint').textContent).toBe(after);
    el('clear').click(); confirm();
    expect(el('status').textContent).toContain('No source data');
    expect(el('checkpoint').textContent).toBe(after);
    el('demo').click();
    el('project').value = 'stadium'; confirm();
    expect(el('status').textContent).toContain('not permitted');
    expect(el('checkpoint').textContent).toBe(after);
    const bad = JSON.parse(receipt); bad.after.outcomes.visits.value = 500;
    el('receipt').value = JSON.stringify(bad); el('replay').click();
    expect(el('status').textContent).toContain('Replay mismatch');
    expect(el('checkpoint').textContent).toBe(after);
    el('receipt').value = receipt; el('replay').click();
    expect(el('status').textContent).toContain('Design replay verified');
    el('project').value = 'plaza'; confirm();
    expect(el('checkpoint').textContent).toContain('90000');
  } finally { globalThis.document = previous; await window.happyDOM.close(); }
});
