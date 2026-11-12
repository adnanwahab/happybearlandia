import { test, expect } from 'bun:test';

test('feedback UI starts opted out, preserves failed input, submits, then stops on opt-out', async () => {
  const original = { document: globalThis.document, fetch: globalThis.fetch, FormData: globalThis.FormData };
  const elements = new Map();
  function element() { return { checked: false, disabled: false, textContent: '', handlers: {}, addEventListener(type, fn) { this.handlers[type] = fn; }, replaceChildren() {}, append() {}, setAttribute() {}, querySelector() { return elements.get('button'); }, reset() { this.resetCalled = true; } }; }
  for (const id of ['#consent','#ballot','#status','#suggestion-status','#suggestion-form','#kind','#replay-seed','button']) elements.set(id, element());
  let calls = [], fail = false;
  globalThis.document = { querySelector: id => elements.get(id), createElement: element };
  globalThis.FormData = class { get(key) { return { title: 'Timeline stopped working', details: 'The timeline froze on the last month.', kind: 'problem', replaySeed: '42' }[key]; } };
  globalThis.fetch = async (path, options) => {
    calls.push({ path, options });
    if (fail) throw new Error('Network unavailable');
    return Response.json(options?.method === 'POST' ? { message: 'Sent for triage.' } : { patches: [], votingEnabled: true });
  };
  try {
    await import('../world/patch-voting.js?feedback-ui-test');
    await new Promise(resolve => setTimeout(resolve, 0));
    const form = elements.get('#suggestion-form'), consent = elements.get('#consent');
    const submit = () => form.handlers.submit({ preventDefault() {} });
    expect(elements.get('button').disabled).toBe(true);
    await submit(); expect(calls).toHaveLength(1);
    consent.checked = true; consent.handlers.change();
    fail = true; await submit();
    expect(elements.get('#suggestion-status').textContent).toBe('Network unavailable');
    expect(form.resetCalled).toBeUndefined();
    fail = false; await submit();
    expect(JSON.parse(calls.at(-1).options.body)).toMatchObject({ consent: true, kind: 'problem', replaySeed: '42' });
    expect(form.resetCalled).toBe(true);
    consent.checked = false; consent.handlers.change();
    const n = calls.length; await submit(); expect(calls).toHaveLength(n);
  } finally { Object.assign(globalThis, original); }
});
