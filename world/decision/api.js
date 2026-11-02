import { createDecisionStore } from "./store.js";
import { executeDecisionExperiment, aggregateDecisionResults } from "./kernel.js";
import { normalizeDecisionInput, createDecisionManifest, DecisionValidationError, DECISION_LIMITS, isTerminal, validId, clone, decisionReplayWorkload } from "./contracts.js";
import { hashWorldEditProposal } from "../ai/revisions.js";
import { getWorldRevisionId } from "../ai/edit-schema.js";
import { validateBuildingPlacement } from "../buildings/proposal.js";
import { summarizeStoredProject } from "../buildings/project-analysis.js";

const base = "/api/decision-experiments";
const json = (value, status = 200, headers = {}) => Response.json(value, { status, headers: { "cache-control": "no-store", ...headers } });
const now = () => new Date().toISOString();

/** Backpressure-aware JSON transport, preserving the full results contract.
 * Bulk consumers can explicitly request ?traces=summary for trace URLs instead;
 * full per-run monthly/project arrays remain available at /runs/:runId. */
function streamResults(value, status = 200) {
  function* chunks() {
    yield "{"; let first = true;
    for (const [key, entry] of Object.entries(value)) {
      yield `${first ? "" : ","}${JSON.stringify(key)}:`; first = false;
      if (key === "runs") { yield "["; for (let index = 0; index < entry.length; index++) yield `${index ? "," : ""}${JSON.stringify(entry[index])}`; yield "]"; }
      else yield JSON.stringify(entry);
    }
    yield "}";
  }
  const iterator = chunks(), encoder = new TextEncoder();
  return new Response(new ReadableStream({ pull(controller) { const next = iterator.next(); if (next.done) controller.close(); else controller.enqueue(encoder.encode(next.value)); }, cancel() { iterator.return?.(); } }), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

async function readBody(request) {
  if (Number(request.headers.get("content-length")) > DECISION_LIMITS.maxBodyBytes) throw new DecisionValidationError(["Request body exceeds 512 KiB"], 413);
  const reader = request.body?.getReader();
  if (!reader) throw new DecisionValidationError(["JSON request body is required"]);
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > DECISION_LIMITS.maxBodyBytes) { await reader.cancel(); throw new DecisionValidationError(["Request body exceeds 512 KiB"], 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new DecisionValidationError(["Request body must be valid JSON"]); }
}

/** API factory used by server.js and tests. Inject {model,simulateRun,store,
 * useWorker:false} for deterministic fault tests. Default uses a module Worker.
 * Endpoints: POST/GET base; GET :id; POST :id/start|cancel; GET :id/runs,
 * :id/runs/:runId, :id/results, :id/events (SSE), :id/manifest, :id/share.
 * SSE event `progress` data is {experiment,progress,status}; terminal snapshots
 * additionally emit `complete`. Results/share include the model schema.
 */
export function createDecisionExperimentsHandler(options = {}) {
  const store = options.store || createDecisionStore(options);
  const active = new Map();
  const listeners = new Map();
  const cached = new Map();
  const writes = new Map();
  const modelModules = new Map();
  const getModel = async (version) => {
    const key = version || "current";
    if (modelModules.has(key)) return modelModules.get(key);
    if (!options.model) {
      const module = await import(version === "1.0.0" ? "../models/housing/legacy-v1.js" : version === "1.1.0" ? "../models/housing/legacy-v1.1.js" : "../models/housing/index.js");
      if (version && module.housingModel.version !== version) throw new DecisionValidationError([`Model version ${version} is unavailable`]);
      modelModules.set(key, module);
      return module;
    }
    let defaults = {};
    if (options.model.id === "housing.v1" && options.stressPresets && !options.applyStressPresets) {
      const housing = await import("../models/housing/index.js");
      if (housing.housingModel.version === options.model.version) defaults = housing;
    }
    if (version && options.model.version !== version) throw new DecisionValidationError([`Model version ${version} is unavailable`]);
    const module = { housingModel: options.model, simulateHousingRun: options.simulateRun, simulateHousingFork: options.simulateFork, validateHousingFork: options.validateFork, applyStressPresets: options.applyStressPresets || defaults.applyStressPresets, stressPresets: options.stressPresets || [] };
    modelModules.set(key, module);
    return module;
  };
  const remember = (record) => {
    cached.set(record.experiment.id, record);
    const weight = (value) => value.runs.reduce((sum, run) => sum + (run.timeline?.length || 0) + (run.monthlyTimeline?.length || 0) + (run.projects || []).reduce((count, project) => count + (project.states?.length || 0), 0), 0);
    let observations = [...cached.values()].reduce((sum, value) => sum + weight(value), 0);
    for (const id of cached.keys()) {
      if (cached.size <= 12 && observations <= DECISION_LIMITS.maxCachedObservations) break;
      if (!active.has(id) && id !== record.experiment.id) { observations -= weight(cached.get(id)); cached.delete(id); }
    }
    return record;
  };
  const persist = (record) => {
    const id = record.experiment.id;
    // Completed rows are append-only. Copy the array and mutable experiment,
    // rather than stringify/parse every monthly project state for each flush.
    const snapshot = { experiment: clone(record.experiment), runs: record.runs.slice() };
    const previous = writes.get(id) || Promise.resolve();
    const next = previous.catch(() => {}).then(() => store.save(snapshot));
    writes.set(id, next);
    next.finally(() => { if (writes.get(id) === next) writes.delete(id); }).catch(() => {});
    return next;
  };
  const notify = (record) => {
    for (const callback of listeners.get(record.experiment.id) || []) callback(record.experiment);
  };
  const load = async (id) => {
    let record = cached.get(id) || await store.load(id);
    if (!record) return null;
    // Workers cannot survive a process restart. Retain actual partial rows,
    // mark interruption honestly, and require a reproduced experiment to rerun.
    if (record.experiment.status === "running" && !active.has(id)) {
      record.experiment.status = "failed";
      record.experiment.error = "Server restarted before this experiment finished. Reproduce its manifest to run again.";
      record.experiment.completedAt = now();
      await persist(record);
    }
    return remember(record);
  };
  const results = (record, model, summary = false) => ({ experiment: record.experiment, runs: summary ? record.runs.map((run) => {
    const { monthlyTimeline, projects, ...row } = run;
    const traceUrl = `${base}/${record.experiment.id}/runs/${run.id}`;
    return { ...row, traceDelivery: "on-demand", traceUrl, monthlyTimelineAvailable: Boolean(monthlyTimeline?.length), monthlyTimelineCount: monthlyTimeline?.length || 0,
      ...(projects ? { projects: projects.map((fullProject) => {
        const { states, ...project } = fullProject;
        return { ...project, projection: "summary", summary: summarizeStoredProject(fullProject), states: [], stateCount: states?.length || 0, finalState: states?.at(-1) || null, traceUrl };
      }) } : {}) };
  }) : record.runs, ...aggregateDecisionResults({ experiment: record.experiment, runs: record.runs, model }), model, ...(summary ? { traceDelivery: "on-demand", traceNote: "Monthly and project states are delivered by each run's traceUrl; no stored replay rows were discarded." } : {}) });
  const attachLinks = (experiment) => ({ ...experiment, resultsUrl: `${base}/${experiment.id}/results`, manifestUrl: `${base}/${experiment.id}/manifest`, shareUrl: `/world/decision.html?experiment=${experiment.id}&readonly=1`, eventsUrl: `${base}/${experiment.id}/events` });

  async function start(record, module) {
    const { experiment } = record;
    if (experiment.status !== "created") throw new DecisionValidationError(["Only a created experiment can start; import its manifest to rerun"], 409);
    if (active.size >= DECISION_LIMITS.maxActive) throw new DecisionValidationError(["Two experiments are already running; wait or cancel one"], 429);
    const projectStates = (value) => value.runs * value.scenarios.reduce((sum, scenario) => sum + (scenario.projects?.length || 0), 0) * (value.years * 12 + 1);
    const activeStates = [...active.keys()].reduce((sum, id) => sum + projectStates(cached.get(id).experiment), 0);
    if (activeStates + projectStates(experiment) > DECISION_LIMITS.maxProjectStates) throw new DecisionValidationError([`Active project replay workload exceeds ${DECISION_LIMITS.maxProjectStates} monthly states; wait or cancel another building experiment`], 429);
    const replay = decisionReplayWorkload(experiment, module.housingModel);
    const activeWeight = [...active.keys()].reduce((sum, id) => sum + decisionReplayWorkload(cached.get(id).experiment, cached.get(id).experiment.modelVersion === "1.2.0" ? { monthlyTimeline: true } : {}).weight, 0);
    if (activeWeight + replay.weight > DECISION_LIMITS.maxReplayWeight) throw new DecisionValidationError(["Active monthly replay workload exceeds memory budget; wait or cancel another experiment"], 429);
    // Avoid retaining an older completed replay beside a new project's worker
    // and its incoming states. Saved records remain available in private storage.
    if (projectStates(experiment)) for (const id of cached.keys()) if (id !== experiment.id && !active.has(id)) cached.delete(id);
    const state = { cancelled: false, worker: null, lastPersist: 0, finished: false };
    active.set(experiment.id, state);
    experiment.status = "running";
    experiment.startedAt = now();
    try { await persist(record); } catch (error) { experiment.status = "created"; active.delete(experiment.id); throw error; }
    notify(record);
    const finish = async (status, error) => {
      if (state.finished) return;
      state.finished = true;
      experiment.status = status;
      experiment.completedAt = now();
      if (error) experiment.error = String(error).slice(0, 2000);
      try { await persist(record); }
      catch (failure) { experiment.status = "failed"; experiment.error = `Persistence failed: ${failure.message}`; }
      active.delete(experiment.id);
      state.worker?.terminate();
      remember(record);
      notify(record);
    };
    const update = (message) => {
      if (state.finished) return;
      record.runs.push(...message.runs);
      experiment.progress = message.progress;
      // Keep terminal lifecycle transition in finish(), after durable snapshot.
      notify(record);
      if (performance.now() - state.lastPersist > 750) {
        state.lastPersist = performance.now();
        persist(record).catch((error) => { state.cancelled = true; state.worker?.postMessage({ type: "cancel" }); finish("failed", `Persistence failed: ${error.message}`); });
      }
    };
    if (options.useWorker !== false && !options.model && typeof Worker !== "undefined") {
      try {
        const worker = new Worker(new URL("./worker.js", import.meta.url).href, { type: "module" });
        state.worker = worker;
        worker.onmessage = ({ data }) => {
          if (data.type === "progress") update(data);
          if (data.type === "done") { experiment.progress = data.progress; state.worker?.terminate(); void finish(state.cancelled ? "cancelled" : data.status); }
          if (data.type === "error") void finish("failed", data.error);
        };
        worker.onerror = (event) => { event.preventDefault?.(); void finish("failed", event.message || "Simulation worker failed"); };
        worker.postMessage({ type: "start", experiment: clone(experiment) });
      } catch (error) { await finish("failed", error.message); }
    } else {
      // Injectable fallback yields after <=8 runs or 12ms. Default server uses
      // a Worker; this route enables tests without worker-specific fault code.
      void executeDecisionExperiment({ experiment, model: module.housingModel, simulateRun: module.simulateHousingRun, simulateFork: module.simulateHousingFork, applyStressPresets: module.applyStressPresets, shouldCancel: () => state.cancelled, onProgress: update })
        .then((result) => finish(result.status)).catch((error) => finish("failed", error.message));
    }
  }

  function eventStream(request, record) {
    let cleanup = () => {};
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        let closed = false;
        let heartbeat;
        const subscriptions = listeners.get(record.experiment.id) || new Set();
        listeners.set(record.experiment.id, subscriptions);
        const close = () => {
          if (closed) return;
          closed = true;
          clearInterval(heartbeat);
          subscriptions.delete(send);
          if (!subscriptions.size) listeners.delete(record.experiment.id);
          request.signal.removeEventListener("abort", close);
          try { controller.close(); } catch { /* already cancelled */ }
        };
        const send = (experiment) => {
          if (closed) return;
          const data = JSON.stringify({ experiment: attachLinks(experiment), progress: experiment.progress, status: experiment.status });
          try {
            controller.enqueue(encoder.encode(`event: progress\ndata: ${data}\n\n`));
            if (isTerminal(experiment.status)) { controller.enqueue(encoder.encode(`event: complete\ndata: ${data}\n\n`)); close(); }
          } catch { close(); }
        };
        cleanup = close;
        subscriptions.add(send);
        request.signal.addEventListener("abort", close, { once: true });
        heartbeat = setInterval(() => { if (!closed) try { controller.enqueue(encoder.encode(": heartbeat\n\n")); } catch { close(); } }, 15000);
        send(record.experiment);
      },
      cancel() { cleanup(); },
    });
    return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-accel-buffering": "no" } });
  }

  const handle = async (request) => {
    try {
      const url = new URL(request.url);
      if (url.pathname !== base && !url.pathname.startsWith(`${base}/`)) return json({ error: "Not found" }, 404);
      const parts = url.pathname.slice(base.length).split("/").filter(Boolean);
      if (parts.length > 3 || parts.some((part) => !validId(part))) return json({ error: "Invalid route or identifier" }, 400);
      if (!parts.length) {
        if (request.method === "GET") {
          const records = await store.list();
          const experiments = [];
          for (const summary of records) {
            let record = cached.get(summary.experiment.id) || summary;
            if (record.experiment.status === "running" && !active.has(record.experiment.id)) record = await load(record.experiment.id);
            experiments.push(attachLinks(record.experiment));
          }
          return json({ experiments });
        }
        if (request.method !== "POST") return json({ error: "Use GET or POST" }, 405, { allow: "GET, POST" });
        const payload = await readBody(request);
        const manifest = payload?.manifest || payload;
        const requestedVersion = manifest?.experiment?.modelVersion || manifest?.modelVersion;
        const module = await getModel(requestedVersion);
        const model = module.housingModel;
        const input = normalizeDecisionInput(payload, model);
        const records = await store.list();
        const isPreview = input.metadata.preview === true;
        if (!isPreview && records.filter((row) => row.experiment.metadata?.preview !== true).length >= DECISION_LIMITS.maxExperiments) return json({ error: "Saved experiment limit reached (100). Configure another private store directory." }, 409);
        // Preview edits are ephemeral: retain the latest 20, never prune saved
        // experiments or active jobs. Shared preview links expire on eviction.
        const previews = records.filter((row) => row.experiment.metadata?.preview === true);
        if (isPreview && previews.length >= DECISION_LIMITS.maxPreviews) {
          const candidates = previews.filter((row) => isTerminal(row.experiment.status) && !active.has(row.experiment.id)).sort((a, b) => a.experiment.createdAt.localeCompare(b.experiment.createdAt));
          const needed = previews.length - DECISION_LIMITS.maxPreviews + 1;
          if (candidates.length < needed || !store.delete) return json({ error: "Preview capacity reached; finish or cancel existing previews first" }, 429);
          for (const row of candidates.slice(0, needed)) {
            await writes.get(row.experiment.id);
            await store.delete(row.experiment.id);
            cached.delete(row.experiment.id);
          }
        }
        // Stored scenario values remain pre-stress; the runner applies presets
        // once to each sampled draw and records both inputs in the run manifest.
        for (const scenario of input.scenarios) {
          for (const id of scenario.stressPresets) {
            if (!(module.stressPresets || []).some((preset) => preset.id === id)) throw new DecisionValidationError([`Unknown stress preset: ${id}`]);
          }
          for (const stress of scenario.scheduledStress || []) if (!(module.stressPresets || []).some((preset) => preset.id === stress.presetId)) throw new DecisionValidationError([`Unknown scheduled stress preset: ${stress.presetId}`]);
        }
        const experiment = attachLinks({ ...input, id: `decision_${crypto.randomUUID()}`, status: "created", createdAt: now(), startedAt: null, completedAt: null, progress: { completed: 0, total: input.runs * input.scenarios.length, successful: 0, failed: 0, elapsedMs: 0 } });
        const record = { experiment, runs: [] };
        await persist(record);
        remember(record);
        return json({ experiment }, 201);
      }
      const record = await load(parts[0]);
      if (!record) return json({ error: "Experiment not found" }, 404);
      const module = await getModel(record.experiment.modelVersion);
      const model = module.housingModel;
      const action = parts[1];
      if (!action && request.method === "GET") return json({ experiment: record.experiment });
      if (action === "forks" && parts.length === 2) {
        if (request.method === "GET") return json({ forks: (await store.list()).map((entry) => entry.experiment).filter((experiment) => experiment.metadata?.timelineFork?.sourceExperimentId === record.experiment.id) });
        if (request.method !== "POST") return json({ error: "Use GET or POST" }, 405);
        if (!model.supportsForks || typeof module.simulateHousingFork !== "function") throw new DecisionValidationError(["This recorded model version cannot fork. Run a new 1.2.0 experiment first; old histories are never reinterpreted."], 409);
        const payload = await readBody(request);
        const source = record.runs.find((run) => run.id === payload.runId && run.status === "completed");
        if (!source) throw new DecisionValidationError(["Select a successfully completed source run"]);
        if (source.timelineFork) throw new DecisionValidationError(["Nested timeline forks are not supported; fork an original future"]);
        const fork = { month: payload.month, operations: payload.operations };
        const checked = module.validateHousingFork?.(fork, { years: record.experiment.years });
        if (!checked?.valid) throw new DecisionValidationError(checked?.errors || ["Invalid fork operations"]);
        if (!fork.operations.length) throw new DecisionValidationError(["A fork needs at least one proposed intervention"]);
        const sourceScenario = record.experiment.scenarios.find((scenario) => scenario.id === source.scenarioId);
        const projects = clone(source.inputProjects || sourceScenario.projects || []).filter((project) => project.status !== "cancelled");
        const placement = record.experiment.metadata?.placementContext || {};
        for (const operation of checked.values.operations) if (operation.op === "add_building") {
          const placed = validateBuildingPlacement(operation.value, { ...placement, buildings: [...(placement.buildings || []), ...projects] });
          if (!placed.valid) throw new DecisionValidationError(placed.errors);
          projects.push(operation.value);
        }
        const lineage = { schemaVersion: "timeline-fork.v1", month: fork.month, operations: checked.values.operations, mode: "selected-future", sourceExperimentId: record.experiment.id, sourceRunId: source.id, sourceScenarioId: source.scenarioId, sourceModelVersion: model.version, sourceSeed: source.seed };
        if (payload.approval !== true) return json({ preview: true, proposal: lineage, requiresApproval: true });
        if (payload.previewHash !== await hashWorldEditProposal({ runId: payload.runId, month: payload.month, operations: payload.operations })) throw new DecisionValidationError(["Fork preview hash does not match approved operations; review the fork again"], 409);
        lineage.approvedAt = now(); lineage.proposalHash = await hashWorldEditProposal({ ...lineage }); lineage.approval = "explicit-user";
        const scenario = { ...clone(sourceScenario), id: "fork", name: `Fork of ${sourceScenario.name} · month ${fork.month}`, kind: "baseline", parameters: clone(source.sampledParameters), uncertainty: {}, stressPresets: [], projects: clone(source.inputProjects || sourceScenario.projects || []), scheduledStress: clone(source.scheduledStress || sourceScenario.scheduledStress || []), timelineFork: lineage };
        delete scenario.inheritsFrom; delete scenario.overrides;
        const input = normalizeDecisionInput({ ...record.experiment, name: `Fork · ${record.experiment.name}`.slice(0, 200), runs: 1, scenarios: [scenario], metadata: { ...clone(record.experiment.metadata), timelineFork: lineage, preview: false, resultsStale: false } }, model);
        if ((await store.list()).filter((entry) => entry.experiment.metadata?.preview !== true).length >= DECISION_LIMITS.maxExperiments) throw new DecisionValidationError(["Saved experiment limit reached"], 409);
        const id = `decision_${crypto.randomUUID()}`;
        const experiment = attachLinks({ ...input, id, createdAt: now(), startedAt: now(), status: "running" });
        const output = await executeDecisionExperiment({ experiment, model, simulateRun: module.simulateHousingRun, simulateFork: module.simulateHousingFork, applyStressPresets: module.applyStressPresets });
        if (output.status !== "completed") throw new DecisionValidationError([output.runs[0]?.error || "Fork failed"], 422);
        const run = output.runs[0];
        const originalPrefix = (source.monthlyTimeline || []).filter((row) => row.month <= fork.month);
        const forkPrefix = (run.monthlyTimeline || []).filter((row) => row.month <= fork.month);
        if (!originalPrefix.length || await hashWorldEditProposal(originalPrefix) !== await hashWorldEditProposal(forkPrefix)) throw new DecisionValidationError(["Fork replay did not preserve the stored pre-branch history; no fork was saved"], 409);
        for (const project of source.projects || []) {
          const forkProject = (run.projects || []).find((entry) => entry.projectId === project.projectId);
          if (!forkProject || await hashWorldEditProposal(project.states.filter((state) => state.month <= fork.month)) !== await hashWorldEditProposal(forkProject.states.filter((state) => state.month <= fork.month))) throw new DecisionValidationError(["Fork replay changed pre-branch project history; no fork was saved"], 409);
        }
        experiment.status = "completed"; experiment.completedAt = now(); experiment.progress = output.progress;
        const revised = { experiment, runs: output.runs }; await persist(revised); remember(revised);
        const deltas = Object.fromEntries(model.metrics.map((metric) => [metric.id, run.metrics[metric.id] - source.metrics[metric.id]]));
        return json({ ...results(revised, model), originalRun: source, run, deltas, lineage }, 201);
      }
      if (action === "visual-revision" && parts.length === 2 && request.method === "POST") {
        if (record.experiment.status !== "completed") throw new DecisionValidationError(["Visual revisions require a completed source experiment"], 409);
        const body = await readBody(request);
        const nextInput = normalizeDecisionInput(body?.input, model);
        const sourceInput = normalizeDecisionInput(record.experiment, model);
        const math = (value) => ({ modelId: value.modelId, modelVersion: value.modelVersion, seed: value.seed, runs: value.runs, years: value.years,
          scenarios: value.scenarios.map(({ name, worldVisuals, ...scenario }) => scenario) });
        if (await hashWorldEditProposal(math(nextInput)) !== await hashWorldEditProposal(math(sourceInput))) throw new DecisionValidationError(["Visual revision changes simulation inputs; create and run a new experiment instead"]);
        const previousHistory = sourceInput.metadata.worldEditHistory || [];
        const history = nextInput.metadata.worldEditHistory || [];
        if (!Array.isArray(previousHistory) || !Array.isArray(history)) throw new DecisionValidationError(["World edit history must be an array"]);
        if (history.length <= previousHistory.length || await hashWorldEditProposal(history.slice(0, previousHistory.length)) !== await hashWorldEditProposal(previousHistory)) throw new DecisionValidationError(["Visual revision must extend the source's immutable approved history"]);
        let parent = getWorldRevisionId(sourceInput);
        for (const revision of history.slice(previousHistory.length)) {
          if (!revision || revision.parent !== parent || !validId(revision.id) || !Number.isFinite(Date.parse(revision.approvedAt)) || !/^[a-f0-9]{64}$/.test(revision.proposalHash || "") || revision.requiresSimulationRerun !== false || !Array.isArray(revision.operations) || (revision.kind !== "restore" && !revision.operations.length) || revision.operations.some((operation) => operation.op !== "change_world_visual")) throw new DecisionValidationError(["Visual revision requires an approved visual-only audit chain"]);
          parent = revision.id;
        }
        if (nextInput.metadata.worldRevision?.id !== parent) throw new DecisionValidationError(["Visual revision does not match the approved audit head"]);
        const records = await store.list();
        if (records.filter((row) => row.experiment.metadata?.preview !== true).length >= DECISION_LIMITS.maxExperiments) throw new DecisionValidationError(["Saved experiment limit reached (100)"], 409);
        nextInput.metadata = { ...nextInput.metadata, preview: false, resultsStale: false, resultsSourceExperimentId: record.experiment.id };
        const experiment = attachLinks({ ...nextInput, id: `decision_${crypto.randomUUID()}`, status: "completed", createdAt: now(), startedAt: record.experiment.startedAt, completedAt: record.experiment.completedAt, progress: clone(record.experiment.progress), resultsSourceExperimentId: record.experiment.id });
        // Monthly states are immutable. Reuse them in memory and persist a new
        // record; only each run's owning experiment/provenance fields change.
        const revised = { experiment, runs: record.runs.map((run) => ({ ...run, experimentId: experiment.id, resultsSourceExperimentId: record.experiment.id })) };
        await persist(revised);
        remember(revised);
        return streamResults(results(revised, model, url.searchParams.get("traces") === "summary"), 201);
      }
      if (action === "start" && parts.length === 2 && request.method === "POST") { await start(record, module); return json({ experiment: record.experiment }, 202); }
      if (action === "cancel" && parts.length === 2 && request.method === "POST") {
        const state = active.get(parts[0]);
        if (state) { state.cancelled = true; state.worker?.postMessage({ type: "cancel" }); record.experiment.cancelRequestedAt = now(); notify(record); }
        else if (record.experiment.status === "created") { record.experiment.status = "cancelled"; record.experiment.completedAt = now(); await persist(record); notify(record); }
        return json({ experiment: record.experiment });
      }
      if (request.method !== "GET") return json({ error: "Method not allowed" }, 405, { allow: "GET" });
      if (action === "runs") {
        if (parts[2]) { const run = record.runs.find((row) => row.id === parts[2]); return run ? json({ run }) : json({ error: "Run not found" }, 404); }
        return streamResults({ runs: record.runs });
      }
      if (parts.length !== 2) return json({ error: "Not found" }, 404);
      if (action === "results") return streamResults(results(record, model, url.searchParams.get("traces") === "summary"));
      if (action === "share") return streamResults({ ...results(record, model, url.searchParams.get("traces") === "summary"), readOnly: true });
      if (action === "manifest") return json(createDecisionManifest(record.experiment, model));
      if (action === "events") {
        if ((listeners.get(record.experiment.id)?.size || 0) >= 16) return json({ error: "Too many event subscriptions" }, 429);
        return eventStream(request, record);
      }
      return json({ error: "Not found" }, 404);
    } catch (error) {
      if (!(error instanceof DecisionValidationError)) console.error("[decision-api]", error);
      return json({ error: error instanceof DecisionValidationError ? error.message : "Decision experiment request failed", ...(error.errors ? { errors: error.errors } : {}) }, error.status || 500);
    }
  };
  handle.store = store;
  handle.close = async () => {
    for (const [id, state] of active) {
      state.cancelled = true;
      state.finished = true;
      state.worker?.terminate();
      const record = cached.get(id);
      if (record && !isTerminal(record.experiment.status)) { record.experiment.status = "cancelled"; record.experiment.completedAt = now(); await persist(record); notify(record); }
      else await writes.get(id);
    }
    active.clear();
    await Promise.allSettled([...writes.values()]);
  };
  return handle;
}
export const createDecisionApiHandler = createDecisionExperimentsHandler;
