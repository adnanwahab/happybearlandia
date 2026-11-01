export function replayStormStrengthLabel(hasRealFloodingData) {
  return hasRealFloodingData
    ? "Storm strength from FEMA flood-insurance claims, Harris County."
    : "Storm strength: simulated (real flood data unavailable)";
}
