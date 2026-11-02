import { buildCivicExperiment } from "./civic-experiment.js";

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

function upstreamShape(value) {
  if (Array.isArray(value)) return "array";
  if (isObject(value)) return "object";
  if (value === null) return "null";
  return typeof value;
}

function candidateCount(value) {
  if (Array.isArray(value)) return value.length;
  if (!isObject(value)) return 0;

  for (const key of ["packages", "plans", "results"]) {
    if (Array.isArray(value[key])) return value[key].length;
  }

  if (isObject(value.package) || isObject(value.plan)) return 1;
  return Object.keys(value).length ? 1 : 0;
}

/**
 * Build the stable HBL /api/plan response envelope.
 *
 * Dear Congress may return either one object or an array of candidate plans.
 * The public HBL API must never leak that shape difference to clients: callers
 * always receive an object with civicExperiment at the top level. The untouched
 * upstream payload remains available under `synthesis` for debugging and newer
 * consumers, while legacy top-level fields are preserved when the synthesis is
 * already an object.
 */
export function buildPlanApiPayload(synthesis, requestPayload = {}, now = new Date()) {
  const civicExperiment = buildCivicExperiment(synthesis, requestPayload, now);
  const shape = upstreamShape(synthesis);
  const count = candidateCount(synthesis);

  return {
    ...(isObject(synthesis) ? synthesis : {}),
    responseSchemaVersion: "hbl-plan-response.v1",
    synthesis,
    civicExperiment,
    hblPlanResponse: {
      schemaVersion: "hbl-plan-response.v1",
      upstreamShape: shape,
      candidateCount: count,
      selectedCandidateIndex: count > 0 ? 0 : null,
    },
  };
}

export const __test = {
  candidateCount,
  upstreamShape,
};
