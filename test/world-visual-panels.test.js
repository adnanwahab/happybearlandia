import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createPanelManager, createPanelState } from '../world/onboarding/panel-manager.js';

// Small injected DOM fixture: exercise ownership transitions without a graphics context.
function fixture() {
  const listeners = new Map();
  const doc = { activeElement: null, querySelectorAll: () => [], addEventListener: (type, fn) => listeners.set(type, fn), removeEventListener: type => listeners.delete(type), createElement: tag => element(tag), getElementById: () => null };
  function element(tag = 'section') {
    const attributes = new Map(), children = [];
    const node = { tagName: tag.toUpperCase(), hidden: false, style: {}, inert: false, isConnected: true,
      setAttribute: (key, value) => attributes.set(key, String(value)), getAttribute: key => attributes.get(key) ?? null, hasAttribute: key => attributes.has(key), removeAttribute: key => attributes.delete(key),
      toggleAttribute(key, flag) { if (flag) attributes.set(key, ''); else attributes.delete(key); },
      querySelector: () => children.find(child => child.hasAttribute('data-world-dismiss')) || null,
      prepend(child) { children.unshift(child); child.remove = () => children.splice(children.indexOf(child), 1); },
      contains: child => children.includes(child), closest: () => null,
      focus() { doc.activeElement = node; },
    };
    return node;
  }
  doc.body = element('body');
  return { doc, element, dispatch: (type, event) => listeners.get(type)?.(event), listeners };
}

test('panel state rejects unknown identities and only closes its active owner', () => {
  const changes = [], state = createPanelState(change => changes.push(change));
  state.register('guide'); state.register('cycle');
  expect(() => state.open('made-up')).toThrow('Unknown');
  expect(() => state.register('guide')).toThrow('Duplicate');
  state.open('guide'); state.open('cycle');
  expect(state.close('guide')).toBe(false);
  expect(state.getState()).toEqual({ active: 'cycle' });
  state.unregister('cycle');
  expect(state.getState()).toEqual({ active: null });
  expect(changes).toEqual([{active:'guide',previous:null},{active:'cycle',previous:'guide'},{active:null,previous:'cycle'}]);
});

test('opening a result suppresses the guide and Escape restores its trigger', () => {
  const { doc, element, dispatch } = fixture(), guide = element(), result = element(), trigger = element('button');
  guide.hidden = true; result.style.display = 'none';
  const panels = createPanelManager({ document: doc });
  panels.register('guide', guide); panels.register('cycle', result);
  panels.open('guide', { trigger });
  expect(guide.inert).toBe(false); expect(doc.activeElement).toBe(guide);
  panels.open('cycle', { trigger });
  expect(guide.inert).toBe(true); expect(guide.hasAttribute('data-world-panel-suppressed')).toBe(true);
  expect(result.inert).toBe(false); expect(result.style.display).toBe('block');
  let prevented = false;
  dispatch('keydown', {key:'Escape',preventDefault(){prevented=true;}});
  expect(prevented).toBe(true); expect(panels.getActive()).toBe(null);
  expect(doc.activeElement).toBe(trigger); expect(result.style.display).toBe('none');
  panels.dispose();
});

test('legacy style visibility requests reopen dismissed results and preserve data', () => {
  const { doc, element } = fixture(), panel = element(); panel.style.display = 'none'; panel.payload = {actual:17};
  const panels = createPanelManager({document:doc,panels:{cycle:panel}});
  panel.style.display = 'block'; panels.sync();
  expect(panels.getActive()).toBe('cycle');
  panels.closeAll(); panel.style.display = 'block'; panels.sync();
  expect(panels.getActive()).toBe('cycle'); expect(panel.payload.actual).toBe(17);
  // A result renderer may replace its entire contents. The dismissal control returns.
  panel.querySelector('[data-world-dismiss]').remove(); panels.sync();
  expect(panel.querySelector('[data-world-dismiss]')).not.toBeNull();
  panels.dispose(); expect(panel.inert).toBe(false);
});

test('hidden-based feature closes on replacement; disposal removes listeners once', () => {
  const {doc,element,listeners}=fixture(), activity=element(), guide=element();
  activity.hidden=true; guide.hidden=true; let closes=0;
  const panels=createPanelManager({document:doc});
  panels.register('activity',activity,{onClose(){closes++;activity.hidden=true;}});
  panels.register('guide',guide);
  panels.open('activity'); panels.open('guide'); panels.sync();
  expect(closes).toBe(1); expect(activity.hidden).toBe(true); expect(panels.getActive()).toBe('guide');
  panels.close('activity'); expect(panels.getActive()).toBe('guide');
  panels.dispose(); panels.dispose(); expect(listeners.size).toBe(0);
});

test('World keeps legacy entry hooks and starts with compact controls', () => {
  const html=readFileSync(new URL('../world/index.html',import.meta.url),'utf8');
  for(const id of ['top','demoBtn','runCycleBtn','cyclePanel','runExperimentBtn','experimentPanel','inspect','activity-dashboard-button'])expect(html).toContain(`id="${id}"`);
  expect(html).toContain('viewport-fit=cover'); expect(html).toContain('/world/first-run-guide.css');
  expect(html).toContain('data-world-open="guide"'); expect(html).not.toContain('id="top" open');
});
