import { expect, test } from 'bun:test';
import { decodeChallenge, encodeChallenge } from '../world/living-city/recipe.js';

const config = { version: 'living-city-commute.v1+city-systems.1.0.0', samples: 100, options: [{ amount: 8 }] };

test('a challenge link pins the rules version, seed, investment and selected pair', () => {
  const recipe = { version: config.version, seed: 4294967295, amount: 8, index: 99 };
  expect(decodeChallenge(encodeChallenge(recipe), config)).toEqual(recipe);
});

test('challenge links reject unsupported models and out-of-bounds simulation inputs', () => {
  for (const value of ['other:2911:8:0', `${config.version}:4294967296:8:0`,
    `${config.version}:2911:9:0`, `${config.version}:2911:8:100`, `${config.version}:2911:8:0:extra`]) {
    expect(() => decodeChallenge(value, config)).toThrow();
  }
});
