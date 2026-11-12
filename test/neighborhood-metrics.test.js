import { describe, expect, test } from 'bun:test';
import { NEIGHBORHOOD_METRICS, lookupNeighborhoodMetric } from '../world/city/neighborhood-metrics.js';
import { createCity } from '../world/city/seed.js';
import { createEngine } from '../world/city/engine.js';
import { CONTRACTS, VERSION } from '../world/city/contracts.js';

describe('audited neighborhood catalog', () => {
  test('has exactly twelve unique stable provisional IDs', () => {
    expect(NEIGHBORHOOD_METRICS.map(row => row.id)).toEqual([
      'population', 'households', 'housing_units', 'available_units',
      'mean_rental_unit_rent', 'unhoused_households', 'employed_workers',
      'unfilled_jobs', 'open_businesses', 'outgoing_link_travel_time',
      'overloaded_facilities', 'utility_shortfalls',
    ]);
    expect(new Set(NEIGHBORHOOD_METRICS.map(row => row.id)).size).toBe(12);
    expect(Object.isFrozen(NEIGHBORHOOD_METRICS)).toBe(true);
  });

  test('every source field exists in initial and engine-produced CityState', () => {
    const initial = createCity({ seed: 33, households: 3 });
    const before = structuredClone(initial);
    const step = createEngine().step(initial);
    for (const state of [initial, step.state]) {
      for (const metric of NEIGHBORHOOD_METRICS) {
        expect(metric.schemaVersion).toBe(CONTRACTS.CityState);
        expect(metric.modelVersion).toBe(VERSION);
        expect(metric.timeScope).toContain('state.month');
        expect(metric.status).toBe('supported');
        expect(metric.unit.length).toBeGreaterThan(0);
        expect(metric.evidence.length).toBeGreaterThan(0);
        expect(metric.missingPolicy).toContain('unavailable');
        expect(state[metric.collection].length).toBeGreaterThan(0);
        for (const row of state[metric.collection]) {
          for (const field of metric.fields) expect(row[field]).not.toBeUndefined();
          expect(state.districts.some(d => d.id === row[metric.districtField])).toBe(true);
        }
      }
    }
    expect(initial).toEqual(before);
  });

  test('unsupported measurements remain unavailable even for plausible proxy names', () => {
    for (const id of ['crime', 'air_pollution', 'life_satisfaction', 'commute_time', 'employment_rate', '__proto__']) {
      const metric = lookupNeighborhoodMetric(id);
      expect(metric.status).toBe('not_modeled');
      expect(metric.value).toBeNull();
      expect(metric.unit).toBeNull();
      expect(metric.sourcePaths).toEqual([]);
      expect(metric.modelVersion).toBe(VERSION);
    }
  });

  test('declares denominator and attribution differences instead of using city-wide proxies', () => {
    expect(lookupNeighborhoodMetric('mean_rental_unit_rent').denominator).toBe('rental-tenure units');
    expect(lookupNeighborhoodMetric('outgoing_link_travel_time').districtField).toBe('from');
    expect(lookupNeighborhoodMetric('outgoing_link_travel_time').denominator).toBe('outgoing links');
    expect(lookupNeighborhoodMetric('employed_workers').missingPolicy).toContain('undefined IDs are missing');
    for (const metric of NEIGHBORHOOD_METRICS) expect(metric.cellValue).toBeNull();
  });
});
