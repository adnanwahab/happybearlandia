import { validatePensieveHandoff } from "./pensieve-handoff.js";

function normalizeOrigins(origins = []) {
  return new Set((Array.isArray(origins) ? origins : [origins]).filter(Boolean).map(String));
}

export function summarizeReceivedExperiment(handoff) {
  const record = handoff?.snapshot || {};
  const experiment = record.experiment || handoff?.snapshot?.experiment || {};
  const simulations = record.simulationBatch?.simulations || [];
  const scenario = record.scenarioComparison || null;
  return {
    schemaVersion: "pensieve-civic-summary.v1",
    experimentId: experiment.id || handoff?.source?.experimentId || null,
    recordId: handoff?.source?.recordId || null,
    title: experiment.plan?.title || handoff?.exhibit?.title || "Civic experiment",
    runs: record.worldBatch?.runs || simulations.length || 0,
    horizonYears: experiment.experiment?.horizonYears || null,
    robustness: record.analyzedExperiment?.analysis?.robustness ?? null,
    weakestScenario: scenario?.weakestFamily?.label || scenario?.weakestFamilyId || null,
    revision: experiment.lineage?.revision || handoff?.source?.revision || 1,
  };
}

export function validatePensieveMessage(event, options = {}) {
  const allowedOrigins = normalizeOrigins(options.allowedOrigins || []);
  if (allowedOrigins.size && !allowedOrigins.has(event?.origin)) return { ok: false, errors: ["origin is not allowed"] };
  if (event?.data?.type !== "hbl:pensieve-civic-handoff") return { ok: false, errors: ["message type is not hbl:pensieve-civic-handoff"] };
  const handoff = event.data.payload;
  const validation = validatePensieveHandoff(handoff);
  if (!validation.ok) return validation;
  const bytes = new TextEncoder().encode(JSON.stringify(handoff)).byteLength;
  const maxBytes = Number(options.maxBytes || 25 * 1024 * 1024);
  if (bytes > maxBytes) return { ok: false, errors: [`handoff exceeds ${maxBytes} byte limit`] };
  return { ok: true, errors: [], handoff, bytes };
}

export function createPensieveCivicReceiver(options = {}) {
  const listeners = new Set();
  const receiver = {
    lastHandoff: null,
    lastSummary: null,
    onReceive(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    acceptEvent(event) {
      const validation = validatePensieveMessage(event, options);
      if (!validation.ok) return validation;
      receiver.lastHandoff = validation.handoff;
      receiver.lastSummary = summarizeReceivedExperiment(validation.handoff);
      for (const fn of listeners) fn(validation.handoff, receiver.lastSummary, event);
      options.onHandoff?.(validation.handoff, receiver.lastSummary, event);
      return { ...validation, summary: receiver.lastSummary };
    },
    attach(windowObject = globalThis.window) {
      if (!windowObject?.addEventListener) throw new Error("A browser window is required");
      const handler = (event) => receiver.acceptEvent(event);
      windowObject.addEventListener("message", handler);
      return () => windowObject.removeEventListener("message", handler);
    },
  };
  return receiver;
}

export async function loadPensieveExperimentFromLocation(options = {}) {
  const locationObject = options.locationObject || globalThis.location;
  if (!locationObject) return null;
  const url = new URL(locationObject.href);
  const id = url.searchParams.get("hbl_record") || url.searchParams.get("hbl_experiment");
  if (!id || typeof options.fetchExperiment !== "function") return null;
  const record = await options.fetchExperiment(id);
  if (!record) return null;
  const experiment = record.experiment || record.snapshot?.experiment;
  return {
    schemaVersion: "pensieve-civic-handoff.v1",
    createdAt: new Date().toISOString(),
    source: {
      application: "happybearlandia",
      recordId: record.id || (url.searchParams.has("hbl_record") ? id : null),
      experimentId: experiment?.id || id,
      planId: experiment?.plan?.id || null,
      revision: experiment?.lineage?.revision || 1,
    },
    exhibit: { title: experiment?.plan?.title || "Civic experiment", subtitle: "Loaded from HBL experiment storage", sections: [] },
    snapshot: record.snapshot || record,
  };
}
