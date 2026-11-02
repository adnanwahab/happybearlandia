function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function buildPensieveHandoff({ record, experiment, sourceUrl = null } = {}) {
  const snapshot = record || (experiment ? { experiment } : null);
  const civicExperiment = record?.experiment || experiment;
  if (!civicExperiment?.plan) throw new Error("A civic experiment or saved record is required");

  return {
    schemaVersion: "pensieve-civic-handoff.v1",
    createdAt: new Date().toISOString(),
    source: {
      application: "happybearlandia",
      url: sourceUrl,
      recordId: record?.id || null,
      experimentId: civicExperiment.id || null,
      planId: civicExperiment.plan?.id || null,
      revision: civicExperiment.lineage?.revision || record?.lineage?.revision || 1,
    },
    exhibit: {
      title: civicExperiment.plan?.title || "Civic experiment",
      subtitle: "journal → plan → assumptions → futures → critique → revision",
      sections: [
        "journal-and-plan",
        "assumptions",
        "outcome-landscape",
        "reality-inspector",
        "failure-modes",
        "revision-lineage",
      ],
    },
    snapshot: clone(snapshot),
  };
}

export function validatePensieveHandoff(handoff) {
  const errors = [];
  if (handoff?.schemaVersion !== "pensieve-civic-handoff.v1") errors.push("schemaVersion must be pensieve-civic-handoff.v1");
  if (!handoff?.source?.experimentId) errors.push("source.experimentId is required");
  if (!handoff?.snapshot?.experiment?.plan) errors.push("snapshot.experiment.plan is required");
  return { ok: errors.length === 0, errors };
}

export function buildPensieveLaunchUrl(baseUrl, handoff) {
  if (!baseUrl) throw new Error("Pensieve URL is required");
  const url = new URL(baseUrl, globalThis.location?.href || "http://localhost/");
  if (handoff?.source?.recordId) url.searchParams.set("hbl_record", handoff.source.recordId);
  if (handoff?.source?.experimentId) url.searchParams.set("hbl_experiment", handoff.source.experimentId);
  if (handoff?.source?.planId) url.searchParams.set("hbl_plan", handoff.source.planId);
  url.searchParams.set("hbl_handoff", "pensieve-civic-handoff.v1");
  return url.href;
}

export function postPensieveHandoff(targetWindow, targetOrigin, handoff) {
  if (!targetWindow || typeof targetWindow.postMessage !== "function") throw new Error("targetWindow.postMessage is required");
  const validation = validatePensieveHandoff(handoff);
  if (!validation.ok) throw new Error(validation.errors.join("; "));
  targetWindow.postMessage({ type: "hbl:pensieve-civic-handoff", payload: handoff }, targetOrigin || "*");
}

export function serializePensieveHandoff(handoff) {
  const validation = validatePensieveHandoff(handoff);
  if (!validation.ok) throw new Error(validation.errors.join("; "));
  return JSON.stringify(handoff, null, 2);
}

export function downloadPensieveHandoff(handoff, { documentObject = globalThis.document, urlObject = globalThis.URL } = {}) {
  const json = serializePensieveHandoff(handoff);
  if (!documentObject || !urlObject?.createObjectURL) throw new Error("Browser download APIs are unavailable");
  const blob = new Blob([json], { type: "application/json" });
  const objectUrl = urlObject.createObjectURL(blob);
  const anchor = documentObject.createElement("a");
  anchor.href = objectUrl;
  anchor.download = `pensieve-${handoff.source.recordId || handoff.source.experimentId}.json`;
  anchor.click();
  setTimeout(() => urlObject.revokeObjectURL(objectUrl), 0);
  return anchor.download;
}
