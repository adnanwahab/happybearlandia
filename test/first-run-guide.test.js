import {test, expect} from 'bun:test';
import {deltaLabel, weekComparisonSummary, QUICK_DEMO_URL} from '../world/first-run-guide.js';

test('first-run guide deltas represent measured changes without guessing missing data', () => {
  expect(deltaLabel(50, 53.3)).toBe('+3.3');
  expect(deltaLabel(50, 49.2)).toBe('−0.8');
  expect(deltaLabel(50, 50)).toBe('0.0');
  expect(deltaLabel(NaN, 3)).toBe('Unavailable');
  expect(deltaLabel(null, 3)).toBe('Unavailable');
  expect(deltaLabel(10, 12, {digits:0, unit:'points'})).toBe('+2 points');
});

test('weekly comparison uses only actual matched simulation metrics', () => {
  const result = weekComparisonSummary({avg:{noPlan:54.1,withPlan:57.2},improved:18,worse:4});
  expect(result.title).toBe('A week, two futures');
  expect(result.metrics).toEqual([
    {label:'Without plan',value:'54.1'},
    {label:'With plan',value:'57.2'},
    {label:'Well-being difference',value:'+3.1'},
    {label:'Residents better off',value:'18'},
    {label:'Residents worse off',value:'4'},
  ]);
  expect(result.description).toContain('synthetic');
  const missing = weekComparisonSummary({avg:{withPlan:10}});
  expect(missing.title).toBe('Comparison incomplete');
  expect(missing.metrics).toEqual([]);
});

test('quick demo uses pinned local World scene, automatic playback and bounded population', () => {
  const u = new URL(QUICK_DEMO_URL, 'https://example.test');
  expect(u.pathname).toBe('/world');
  expect(u.searchParams.get('demo')).toBe('1');
  expect(u.searchParams.get('autoplay')).toBe('1');
  expect(u.searchParams.get('quick')).toBe('1');
  expect(Number(u.searchParams.get('people'))).toBeLessThanOrEqual(120);
});
