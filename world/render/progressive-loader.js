/** Bounded geometry startup scheduler; no THREE/GeometryCache internals required.
 *
 * const loader = createProgressiveLoader({items: town.buildings,
 *   load: b => cache.building({id:b.id,poly:b.poly,height:b.height,kind:b.kind}),
 *   attach: (data,b) => { ...scene.add(mesh); return () => disposeMesh(mesh); },
 *   fallback: (error,b) => { ...attachCheapBox(b); return cleanup; },
 *   disposeSource: () => cache.dispose(), onProgress: renderRealCounts });
 * loader.start(); // DO NOT await before starting the world's animation loop.
 * addEventListener('pagehide', () => loader.dispose(), {once:true});
 *
 * load runs up to concurrency (clamped2–4); inflight+ready+attaching is bounded by
 * the same window. Ready results attach during animation frames, within a count
 * and elapsed-time budget. A single synchronous attachment cannot be preempted:
 * keep attach/fallback cheap and build expensive geometry off the main thread.
 * fallback is responsible for its own cheap attachment, not another load call.
 * attach/fallback may return a cleanup function or {dispose()} for navigation.
 * discard releases unattached/late data only; don't dispose cache-shared arrays.
 * disposeSource is called once on abort/dispose, NOT normal completion: callers
 * may still need the geometry cache for later LOD. No source ownership is inferred.
 * Priority is an ascending numeric score (e.g. squared camera distance); sorting
 * affects queued jobs only and reprioritize() can follow camera movement.
 */
export function createProgressiveLoader(options = {}) {
  const { items = [], load, attach, fallback, discard, disposeSource, onProgress, onError,
    priority, signal, frameBudgetMs = 4, maxAttachmentsPerFrame = 8 } = options;
  if (!Array.isArray(items) || typeof load !== "function" || typeof attach !== "function") throw new TypeError("Progressive loader requires items[], load(), and attach().");
  const concurrency = Math.max(2, Math.min(4, Math.floor(Number(options.concurrency) || 3)));
  const budget = Math.max(0.1, Number(frameBudgetMs) || 4);
  const batchSize = Math.max(1, Math.floor(Number(maxAttachmentsPerFrame) || 8));
  const now = options.now || (() => globalThis.performance?.now?.() ?? Date.now());
  const requestFrame = options.requestFrame || (typeof globalThis.requestAnimationFrame === "function"
    ? (callback) => globalThis.requestAnimationFrame(callback) : (callback) => setTimeout(() => callback(now()), 16));
  const cancelFrame = options.cancelFrame || (typeof globalThis.cancelAnimationFrame === "function"
    ? (id) => globalThis.cancelAnimationFrame(id) : (id) => clearTimeout(id));
  const controller = new AbortController();
  const queue = items.map((item, index) => ({ item, index }));
  const ready = [];
  const cleanup = new Set();
  const counts = { total: items.length, completed: 0, attached: 0, successful: 0, failed: 0, fallbacks: 0,
    cancelled: 0, inFlight: 0, peakInFlight: 0, peakReady: 0, yields: 0, status: "idle" };
  let frameId = null, pumping = false, attaching = 0, settled = false, sourceDisposed = false;
  let resolveDone;
  const done = new Promise((resolve) => { resolveDone = resolve; });
  const getProgress = () => ({ ...counts, queued: queue.length, ready: ready.length, attaching });
  const notify = () => { try { onProgress?.(getProgress()); } catch { /* UI hooks cannot stop loading. */ } };
  const report = (error, job, phase) => { try { onError?.(error, job.item, { index: job.index, phase }); } catch { /* Isolate observers. */ } };
  const release = (value, job) => { try { discard?.(value, job.item, { index: job.index }); } catch (error) { report(error, job, "discard"); } };
  const stopSource = () => {
    if (sourceDisposed) return;
    sourceDisposed = true;
    try { disposeSource?.(); } catch { /* Disposal must still settle cancellation. */ }
  };
  const retainCleanup = (value) => {
    const callback = typeof value === "function" ? value : typeof value?.dispose === "function" ? () => value.dispose() : null;
    if (!callback) return;
    if (controller.signal.aborted) { try { callback(); } catch {} } else cleanup.add(callback);
  };
  function reprioritize() {
    if (typeof priority !== "function") return;
    const scores = new Map();
    for (const job of queue) {
      let score = Infinity;
      try { const candidate = priority(job.item, job.index); if (Number.isFinite(candidate)) score = candidate; } catch {}
      scores.set(job, score);
    }
    queue.sort((a, b) => (scores.get(a) - scores.get(b)) || a.index - b.index);
  }
  function finishIfDone() {
    if (settled || counts.status !== "running" || queue.length || counts.inFlight || ready.length || attaching) return;
    counts.status = "completed";
    settled = true;
    signal?.removeEventListener("abort", externalAbort);
    notify(); resolveDone(getProgress());
  }
  function schedule() {
    if (counts.status !== "running" || pumping || frameId !== null || !ready.length) return;
    frameId = requestFrame(() => { frameId = null; void pump(); });
  }
  function fill() {
    if (counts.status !== "running") return;
    while (queue.length && counts.inFlight + ready.length + attaching < concurrency) {
      const job = queue.shift();
      counts.inFlight++;
      counts.peakInFlight = Math.max(counts.peakInFlight, counts.inFlight);
      Promise.resolve().then(() => {
        if (controller.signal.aborted) return;
        return load(job.item, { signal: controller.signal, index: job.index });
      }).then((value) => {
        counts.inFlight--;
        if (controller.signal.aborted) { if (value !== undefined) release(value, job); return; }
        ready.push({ ...job, value });
        counts.peakReady = Math.max(counts.peakReady, ready.length);
        notify(); schedule();
      }, (error) => {
        counts.inFlight--;
        if (controller.signal.aborted) return;
        ready.push({ ...job, error, loadFailed: true });
        counts.peakReady = Math.max(counts.peakReady, ready.length);
        notify(); schedule();
      });
    }
    notify(); finishIfDone();
  }
  async function pump() {
    if (counts.status !== "running") return;
    pumping = true;
    counts.yields++;
    const start = now();
    let processed = 0;
    try {
      while (ready.length && !controller.signal.aborted && processed < batchSize && (processed === 0 || now() - start < budget)) {
        const job = ready.shift();
        attaching++;
        const context = { signal: controller.signal, index: job.index };
        try {
          if (job.loadFailed) throw job.error;
          const resource = await attach(job.value, job.item, context);
          retainCleanup(resource);
          if (!controller.signal.aborted) { counts.successful++; counts.attached++; }
        } catch (error) {
          if (!controller.signal.aborted) {
            counts.failed++;
            report(error, job, job.loadFailed ? "load" : "attach");
            if (typeof fallback === "function") {
              try {
                const resource = await fallback(error, job.item, context);
                retainCleanup(resource);
                if (!controller.signal.aborted) { counts.fallbacks++; counts.attached++; }
              } catch (fallbackError) { report(fallbackError, job, "fallback"); }
            }
          }
          if (!job.loadFailed) release(job.value, job);
        } finally {
          attaching--;
          if (!controller.signal.aborted) counts.completed++;
          processed++;
        }
      }
    } finally {
      pumping = false;
      if (!controller.signal.aborted) { notify(); fill(); schedule(); finishIfDone(); }
    }
  }
  function abort(reason = "Progressive loading cancelled") {
    if (controller.signal.aborted) return;
    controller.abort(reason);
    if (frameId !== null) { cancelFrame(frameId); frameId = null; }
    counts.cancelled = counts.total - counts.completed;
    counts.status = "cancelled";
    queue.length = 0;
    for (const job of ready.splice(0)) if (!job.loadFailed) release(job.value, job);
    stopSource();
    signal?.removeEventListener("abort", externalAbort);
    notify();
    if (!settled) { settled = true; resolveDone(getProgress()); }
  }
  function externalAbort() { abort(signal.reason); }
  function dispose() {
    abort("Progressive loader disposed");
    for (const callback of cleanup) { try { callback(); } catch {} }
    cleanup.clear();
  }
  function start() {
    if (counts.status !== "idle") return done;
    if (signal?.aborted) { abort(signal.reason); return done; }
    counts.status = "running";
    signal?.addEventListener("abort", externalAbort, { once: true });
    reprioritize(); fill();
    return done;
  }
  return { start, done, abort, dispose, getProgress, reprioritize };
}
