import { describe, it, expect } from 'bun:test';
import { validateScene, loadScene } from '../game/scene-loader.js';
import scene from '../game/scene.json';

const copy = () => structuredClone(scene);

describe('editable game scene', () => {
  it('preserves the original geometry and physics settings', () => {
    expect(validateScene(copy()).objects).toHaveLength(61);
    expect(scene.objects.filter(object => object.id.startsWith('stair-'))).toHaveLength(45);
    expect(scene.objects.filter(object => object.id.startsWith('slope-'))).toHaveLength(10);
    expect(scene.gravity).toEqual([0, -25, 0]);
    expect(scene.objects.find(object => object.id === 'teal-cube').size).toEqual([1.5, 1.5, 1.5]);
  });

  it('rejects ambiguous IDs and missing gameplay objects', () => {
    const duplicate = copy();
    duplicate.objects.push(duplicate.objects[0]);
    expect(() => validateScene(duplicate)).toThrow('unique');
    const missing = copy();
    missing.objects = missing.objects.filter(object => object.id !== 'teal-cube');
    expect(() => validateScene(missing)).toThrow('missing gameplay object teal-cube');
  });

  it('rejects invalid physics values before constructing bodies', () => {
    for (const [field, value] of [
      ['size', [1, 0, 1]], ['position', [0, NaN, 0]],
      ['rotation', [0, 0, 0, 0]], ['motion', 'unknown'],
      ['mass', -1], ['friction', -1], ['color', 'bad']
    ]) {
      const invalid = copy();
      invalid.objects[0][field] = value;
      expect(() => validateScene(invalid)).toThrow();
    }
  });

  it('loads JSON and reports HTTP and malformed JSON errors', async () => {
    const url = `data:application/json,${encodeURIComponent(JSON.stringify(scene))}`;
    expect((await loadScene(url)).objects).toHaveLength(61);
    await expect(loadScene('data:application/json,invalid')).rejects.toThrow();
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => new Response('', { status: 404 });
      await expect(loadScene('/missing.json')).rejects.toThrow('HTTP 404');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
