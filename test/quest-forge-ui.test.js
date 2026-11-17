import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
const domModule = process.env.HBL_DOM_MODULE;
test.skipIf(!domModule)('normal World navigation, no data, demo success/failure, cancellation and stale source clearing', async () => {
  const { Window } = await import(domModule);
  const window = new Window({ url: 'http://localhost/world/quest-forge/' });
  const html = await readFile(new URL('../world/quest-forge/index.html', import.meta.url), 'utf8');
  const world = await readFile(new URL('../world/index.html', import.meta.url), 'utf8');
  expect(world).toContain('href="/world/quest-forge/"');
  window.document.write(html);
  const oldDocument = globalThis.document, oldAdd = globalThis.addEventListener;
  globalThis.document = window.document; globalThis.addEventListener = window.addEventListener.bind(window);
  const $ = id => window.document.getElementById(id);
  const change = (id, value) => { $(id).value = value; $(id).dispatchEvent(new window.Event('change')); };
  const waitFor = async predicate => { for (let i = 0; i < 500 && !predicate(); i++) await new Promise(r => setTimeout(r, 2)); expect(predicate()).toBe(true); };
  try {
    await import('../world/quest-forge/page.js');
    expect(window.document.querySelector('a').getAttribute('href')).toBe('/world');
    expect($('status').textContent).toContain('No source data'); expect($('quest').hidden).toBe(true);
    change('source', 'demo'); await waitFor(() => !$('quest').hidden);
    expect($('origin').textContent).toContain('demo-housing-request'); expect($('terms').textContent).toContain('month 20');
    $('run').click(); await waitFor(() => !$('result').hidden);
    expect($('verdict').textContent).toBe('Modeled objective met'); expect($('outcome').textContent).toContain('control 6; candidate 4');
    change('plan', 'none'); expect($('result').hidden).toBe(true); expect($('receipt').textContent).toBe('');
    $('run').click(); await waitFor(() => !$('result').hidden);
    expect($('verdict').textContent).toBe('Objective not met');
    change('plan', 'housing'); $('run').click(); $('cancel').click();
    await new Promise(r => setTimeout(r, 100));
    expect($('status').textContent).toContain('cancelled'); expect($('result').hidden).toBe(true);
    $('run').click(); change('source', 'logged'); await new Promise(r => setTimeout(r, 100));
    expect($('status').textContent).toContain('No source data'); expect($('quest').hidden).toBe(true); expect($('result').hidden).toBe(true); expect($('evidence').textContent).toBe('');
    change('source', 'demo'); change('source', 'logged'); await new Promise(r => setTimeout(r, 100));
    expect($('quest').hidden).toBe(true); expect($('status').textContent).toContain('No source data');
  } finally { window.dispatchEvent(new window.Event('pagehide')); globalThis.document = oldDocument; globalThis.addEventListener = oldAdd; await window.happyDOM.close(); }
});
