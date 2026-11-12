import { describe, it, expect } from 'bun:test';
import { createHoneyTrail, HONEY_DROPS } from '../game/honey-trail.js';
import { createHoneyTrailView } from '../game/honey-trail-view.js';
import * as THREE from 'three';

describe('Honey Trail v1', () => {
  it('waits for first pickup and collects each drop only once', () => {
    const trail = createHoneyTrail();
    expect(trail.update([0, 0, 0], 10).elapsed).toBe(0);
    expect(trail.update(HONEY_DROPS[0], 2).collected).toEqual([0]);
    const state = trail.update(HONEY_DROPS[0], 3);
    expect(state.collected).toEqual([0]);
    expect(state.elapsed).toBe(3);
    expect(state.complete).toBe(false);
  });

  it('checks horizontal and vertical pickup boundaries', () => {
    const trail = createHoneyTrail();
    expect(trail.update([0, 0, 3.19], 0).collected).toEqual([]);
    expect(trail.update([0, 2.51, 5], 0).collected).toEqual([]);
    expect(trail.update([NaN, 0, 5], 0).collected).toEqual([]);
    expect(trail.update([0, 2.5, 5], 0).collected).toEqual([0]);
  });

  it('freezes completion time, retains best on replay, and allows improvement', () => {
    const trail = createHoneyTrail();
    for (const point of HONEY_DROPS) trail.update(point, 2);
    expect(trail.snapshot()).toMatchObject({ complete: true, elapsed: 14, best: 14 });
    expect(trail.update([0, 0, 0], 100).elapsed).toBe(14);
    expect(trail.restart()).toMatchObject({ collected: [], elapsed: 0, best: 14, started: false });
    for (const point of HONEY_DROPS) trail.update(point, 3);
    expect(trail.snapshot().best).toBe(14);
    trail.restart();
    for (const point of HONEY_DROPS) trail.update(point, 1);
    expect(trail.snapshot().best).toBe(7);
  });

  it('keeps progress through respawn and rejects invalid time increments', () => {
    const trail = createHoneyTrail();
    trail.update(HONEY_DROPS[0], 0);
    for (const delta of [-1, Infinity, NaN]) trail.update([0, 0, 0], delta);
    expect(trail.snapshot()).toMatchObject({ collected: [0], elapsed: 0 });
    const state = trail.snapshot();
    state.collected.push(5);
    expect(trail.snapshot().collected).toEqual([0]);
  });

  it('integrates scene markers, progress, completion and the replay button', () => {
    // Minimal DOM adapter: exercise the real view and real Three scene without
    // claiming WebGL or browser verification when a local server cannot start.
    const originalDocument = globalThis.document;
    const elements = new Map();
    const panel = {
      setAttribute() {},
      querySelector(selector) {
        if (!elements.has(selector)) elements.set(selector, {
          textContent: '', addEventListener(_type, handler) { this.click = handler; }, blur() {},
        });
        return elements.get(selector);
      },
    };
    globalThis.document = { createElement: () => panel, body: { appendChild() {} } };
    try {
      const scene = new THREE.Scene();
      const view = createHoneyTrailView(scene);
      expect(scene.children).toHaveLength(8);
      expect(elements.get('.honey-progress').textContent).toContain('0 / 8');
      for (const [x, y, z] of HONEY_DROPS) view.update({ x, y, z }, 1, 1);
      expect(elements.get('.honey-progress').textContent).toContain('Trail complete');
      expect(elements.get('.honey-time').textContent).toContain('Session best: 7.0s');
      expect(scene.children.every(marker => !marker.visible)).toBe(true);
      elements.get('button').click();
      expect(scene.children.every(marker => marker.visible)).toBe(true);
      expect(elements.get('.honey-progress').textContent).toContain('0 / 8');
      expect(elements.get('.honey-time').textContent).toBe('0.0s · Session best: 7.0s');
    } finally {
      if (originalDocument === undefined) delete globalThis.document;
      else globalThis.document = originalDocument;
    }
  });
});
