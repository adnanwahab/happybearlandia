import { expect, test } from 'bun:test';
import { runPlan } from '../world/invention/model.js';
import { measureSensors, normalizeSensors, OBSERVATORY_VERSION, SENSOR_BUDGET } from '../world/learning/observatory.js';

const sensor = (districtId, metric) => ({ districtId, metric });

test('sensor records reproduce deterministic measurements from every retained district snapshot', () => {
  const baseline = runPlan({ seed: 2911, months: 12, policies: [] }, { retainMonths: true });
  const placements = [sensor('d1', 'meanCommuteMinutes'), sensor('d1', 'meanRent'), sensor('d1', 'housingUnits')];
  const records = measureSensors(baseline, placements);
  expect(records).toEqual(measureSensors(baseline, placements));
  expect(records).toHaveLength(13 * placements.length);
  expect(records[0].month).toBe(baseline.start.month);
  expect(records.at(-1).month).toBe(baseline.final.month);
  expect(records[0].provenance).toMatchObject({
    kind: 'simulated-snapshot', modelVersion: baseline.recipe.modelVersion,
    scenarioVersion: baseline.scenarioVersion, seed: baseline.recipe.seed,
    sensorVersion: OBSERVATORY_VERSION,
  });
  const snapshots = new Map(baseline.series.map(row => [row.month, row.districts.find(district => district.id === 'd1')]));
  for (const record of records) {
    const source = snapshots.get(record.month)[record.metric];
    expect(record.uncertainty.lower).toBeLessThanOrEqual(source);
    expect(record.uncertainty.upper).toBeGreaterThanOrEqual(source);
    expect(record.status).toBe('measured');
    if (record.metric === 'housingUnits') {
      expect(record).toMatchObject({ value: source, uncertainty: { lower: source, upper: source } });
    }
  }
});

test('zero trips is a measurement while commute time with no trips and absent snapshots are unavailable', () => {
  const baseline = {
    series: [
      { month: 2, districts: [{ id: 'd1', commuteCount: 0, meanCommuteMinutes: null }] },
      { month: 3, districts: [] },
    ],
  };
  const records = measureSensors(baseline, [sensor('d1', 'commuteCount'), sensor('d1', 'meanCommuteMinutes')]);
  expect(records[0]).toMatchObject({ status: 'measured', value: 0, uncertainty: { lower: 0, upper: 0 } });
  expect(records[1]).toMatchObject({
    status: 'unavailable', value: null, uncertainty: null, reason: 'No modeled commutes in this district and month',
  });
  expect(records[2]).toMatchObject({ status: 'unavailable', value: null, reason: 'District snapshot unavailable' });
});

test('placement validates supported district metrics, duplicates, and the shared budget', () => {
  const baseline = runPlan({ months: 1 }, { retainMonths: true });
  const full = [sensor('d0', 'meanCommuteMinutes'), sensor('d1', 'meanCommuteMinutes'), sensor('d1', 'commuteCount')];
  expect(SENSOR_BUDGET).toBe(100);
  expect(normalizeSensors(full, baseline)).toEqual(full);
  expect(() => normalizeSensors([...full, sensor('d2', 'commuteCount')], baseline)).toThrow('budget');
  expect(() => normalizeSensors([full[0], full[0]], baseline)).toThrow('already');
  expect(() => normalizeSensors([sensor('d4', 'meanRent')], baseline)).toThrow('district');
  expect(() => normalizeSensors([sensor('d1', 'airQuality')], baseline)).toThrow('metric');
  expect(() => normalizeSensors([sensor('d1', ['meanRent'])], baseline)).toThrow('metric');
  expect(() => measureSensors({ series: null }, [])).toThrow('retained monthly');
});
