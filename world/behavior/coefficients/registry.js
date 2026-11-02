/** Illustrative coefficients, supplied as assumptions rather than empirical estimates. */
const make = (id, coefficients, units) => Object.freeze({ id, version: '1.0.0', coefficients: Object.freeze(coefficients), units: Object.freeze(units),
  source: 'analyst-assumption', confidence: 'low', calibrationDataset: null, calibrationDate: null, errorMetrics: null, calibratedRange: null });
export const BEHAVIOR_COEFFICIENTS = Object.freeze({
  'mode-choice-v1': make('mode-choice-v1', { travelTime: -0.048, waitTime: -0.072, walkTime: -0.063, monetaryCost: -0.31, parkingCost: -0.21, habit: 0.18 }, { travelTime: 'minutes', waitTime: 'minutes', walkTime: 'minutes', monetaryCost: 'USD/trip', parkingCost: 'USD/trip', habit: 'index' }),
  'housing-choice-v1': make('housing-choice-v1', { affordability: 1.5, commute: -0.025, space: 0.4, amenities: 0.35, movingCost: -0.0001, inertia: -0.4 }, { affordability: 'index', commute: 'minutes', space: 'index', amenities: 'index', movingCost: 'USD', inertia: 'index' }),
});
export function getBehaviorCoefficients(id) {
  const value = BEHAVIOR_COEFFICIENTS[id];
  if (!value) throw new Error(`Unknown behavior coefficient model: ${id}`);
  return value;
}
