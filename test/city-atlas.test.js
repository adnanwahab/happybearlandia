import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { EXPERIENCES } from '../world/universe/registry.js';
import { experienceFromLocation, isRegisteredHTMLFile } from '../world/universe/html-navigation.js';

const route = '/world/city-atlas.html';
const html = readFileSync(new URL('../world/city-atlas.html', import.meta.url), 'utf8');

describe('scroll-driven City Atlas', () => {
  test('is discoverable in the experience directory and uses the normal World static route', () => {
    const experience = EXPERIENCES.find((entry) => entry.id === 'city-atlas');
    expect(experience?.route).toBe(route);
    expect(experience?.evidence).toBe('synthetic');
    expect(experienceFromLocation(route)?.id).toBe('city-atlas');
    expect(isRegisteredHTMLFile('world/city-atlas.html')).toBe(true);
    expect(html).toContain('href="/world"');
  });

  test('presents all five scroll-driven scenes without claiming simulated results', () => {
    expect((html.match(/class="chapter"/g) || []).length).toBe(5);
    for (const id of ['build', 'life', 'motion', 'risk', 'futures']) {
      expect(html).toContain(`id="${id}"`);
    }
    expect(html).toContain('All geography, populations, and policy outcomes are synthetic');
    expect(html).toContain('id="compare-range"');
    expect(html).toContain('aria-label="Choose a visualization"');
  });

  test('keeps the demo self-contained, with GPU and Canvas fallback renderers', () => {
    expect(html).toContain("getContext('webgl2'");
    expect(html).toContain("getContext('2d')");
    expect(html).toContain('window.startHBLFallback');
    expect(html).not.toMatch(/<script[^>]+src=/i);
    expect(html).not.toMatch(/<link[^>]+href=["']https?:/i);
    for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
      expect(() => new Script(match[1])).not.toThrow();
    }
  });
});
