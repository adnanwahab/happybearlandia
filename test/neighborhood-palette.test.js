import { test, expect } from 'bun:test';
import { DEFAULT, STYLES, recipe, serialize, colors, scene } from '../world/invention/palette/recipe.js';
test('all preset combinations replay identical artwork without mutating inputs', () => {
 for (const architecture of Object.keys(STYLES)) for (const vegetation of Object.keys(STYLES)) for (const lighting of Object.keys(STYLES)) {
  const value = Object.freeze({ ...DEFAULT, architecture, vegetation, lighting });
  const saved = serialize(value);
  expect(scene(JSON.parse(saved))).toBe(scene(value));
  expect(serialize(value)).toBe(saved);
  expect(colors(value).wall).toBe(STYLES[architecture].wall);
 }
});
test('missing, malformed, future and injected model state are rejected', () => {
 for (const value of [null, {}, { ...DEFAULT, version: 'future' }, { ...DEFAULT, lighting: 'unknown' }, { ...DEFAULT, architecture: '<script>' }, { ...DEFAULT, budget: 1 }]) expect(() => recipe(value)).toThrow();
 expect(recipe(DEFAULT)).toEqual(DEFAULT);
});
test('cosmetic controller has no model or network dependency', async () => {
 const source = await Bun.file('world/invention/palette/page.js').text();
 expect(source.match(/^import .*$/gm)).toEqual(["import { DEFAULT, recipe, serialize, scene } from './recipe.js';"]);
 expect(source).not.toMatch(/fetch\(|Worker\(|Math.random|\/api\//);
});
test('controller saves, reloads, resets and handles unavailable or corrupt storage', async () => {
 const previousDocument = globalThis.document;
 const previousStorage = globalThis.localStorage;
 try {
  let stored = null, unavailable = false;
  globalThis.localStorage = {
   getItem() { if (unavailable) throw Error('denied'); return stored; },
   setItem(key, value) { if (unavailable) throw Error('denied'); stored = value; },
   removeItem() { if (unavailable) throw Error('denied'); stored = null; },
  };
  let sequence = 0;
  async function mount() {
   const nodes = Object.fromEntries(['[role=status]', '#palette-after', '#palette-before', '#palette-diff', '#palette-save', '#palette-reset'].map(k => [k, {}]));
   const controls = ['architecture', 'vegetation', 'lighting'].map(name => ({ name, addEventListener(event, handler) { this.change = handler; } }));
   globalThis.document = { querySelector: () => ({ querySelector: k => nodes[k], querySelectorAll: () => controls }) };
   await import(`../world/invention/palette/page.js?controller-test=${sequence++}`);
   return { nodes, controls };
  }
  let ui = await mount();
  expect(ui.nodes['[role=status]'].textContent).toContain('No saved recipe');
  ui.controls[0].value = 'whimsical'; ui.controls[0].change();
  expect(ui.nodes['#palette-after'].innerHTML).not.toBe(ui.nodes['#palette-before'].innerHTML);
  ui.nodes['#palette-save'].onclick();
  expect(JSON.parse(stored).architecture).toBe('whimsical');
  const artwork = ui.nodes['#palette-after'].innerHTML;
  ui = await mount(); expect(ui.nodes['#palette-after'].innerHTML).toBe(artwork);
  ui.nodes['#palette-reset'].onclick(); expect(stored).toBeNull();
  expect(ui.nodes['#palette-after'].innerHTML).toBe(ui.nodes['#palette-before'].innerHTML);
  stored = '{broken'; ui = await mount();
  expect(ui.nodes['[role=status]'].textContent).toContain('unsupported');
  expect(ui.controls.map(c => c.value)).toEqual(['original', 'original', 'original']);
  unavailable = true; ui = await mount();
  ui.nodes['#palette-save'].onclick(); expect(ui.nodes['[role=status]'].textContent).toContain('not saved');
  ui.nodes['#palette-reset'].onclick(); expect(ui.nodes['[role=status]'].textContent).toContain('could not be cleared');
 } finally { globalThis.document = previousDocument; globalThis.localStorage = previousStorage; }
});
