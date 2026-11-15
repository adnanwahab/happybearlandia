import {test, expect} from 'bun:test';
import {EXPERIENCES} from '../world/universe/registry.js';
import {illustration, staleLabel, MAX_PEEK_BYTES} from '../tools/world-peek.js';

test('every registered category has bounded inert artwork, aggregate under 32 KiB', () => {
  let total = 0;
  for (const experience of EXPERIENCES) {
    const svg = illustration(experience.category);
    const bytes = new TextEncoder().encode(svg).byteLength;
    expect(bytes).toBeLessThanOrEqual(MAX_PEEK_BYTES);
    expect(svg).toContain('not a simulation snapshot');
    expect(svg).not.toMatch(/href=|<script|<image|<animate|<foreignObject/);
    total += bytes;
  }
  expect(total).toBeLessThan(32768);
  console.log(`Inline preview artwork: ${total} bytes for ${EXPERIENCES.length} cards`);
});
test('staleness boundaries and invalid clocks disclose uncertainty', () => {
  const start = Date.parse('2026-11-15T00:00:00Z');
  expect(staleLabel(start + 30 * 86400000)).not.toContain('Stale');
  expect(staleLabel(start + 30 * 86400000 + 1)).toContain('Stale');
  expect(staleLabel(start - 1)).toContain('Stale');
  expect(staleLabel(NaN)).toContain('Stale');
});
