#!/usr/bin/env bun
import { resolveCivicExperimentPayload } from "../world/experiment-contract.js";
import { formatVerificationReport, runExperimentVerification } from "../world/experiment-verification.js";

const baseUrl = (process.env.HBL_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const requestBody = { runs: 32, years: 10, seed: 424242 };

async function main() {
  const response = await fetch(`${baseUrl}/api/plan`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(requestBody),
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`/api/plan returned non-JSON (${response.status})`);
  }
  if (!response.ok) throw new Error(payload?.error || `/api/plan returned HTTP ${response.status}`);

  const serverContract = payload?.civicExperiment?.schemaVersion === "civic-experiment.v1";
  const marker = response.headers.get("x-hbl-civic-experiment");
  console.log(`${serverContract ? "PASS" : "FAIL"}  api-contract        /api/plan ${serverContract ? "returned" : "did not return"} civicExperiment.v1`);
  console.log(`${marker === "civic-experiment.v1" ? "PASS" : "WARN"}  api-header          x-hbl-civic-experiment=${marker || "<missing>"}`);

  const resolved = resolveCivicExperimentPayload(payload, requestBody);
  if (resolved.warning) console.log(`WARN  local-fallback      ${resolved.warning}`);
  const report = await runExperimentVerification(resolved.experiment, { runs: 32 });
  console.log(formatVerificationReport(report));

  if (!serverContract || !report.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`FAIL  verifier            ${error?.stack || error}`);
  process.exitCode = 1;
});
