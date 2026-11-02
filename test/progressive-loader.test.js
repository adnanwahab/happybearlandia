import { describe, expect, test } from "bun:test";
import { createProgressiveLoader } from "../world/render/progressive-loader.js";

const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
function clock() {
  const frames = new Map();
  let next = 0, time = 0;
  return {
    options: { requestFrame: (callback) => { frames.set(++next, callback); return next; }, cancelFrame: (id) => frames.delete(id), now: () => time },
    cost: (ms) => { time += ms; },
    async frame() { const callbacks = [...frames.values()]; frames.clear(); for (const callback of callbacks) callback(time); await flush(); },
    async finish(loader) { for (let i = 0; i < 1000 && loader.getProgress().status === "running"; i++) { await flush(); await this.frame(); } return loader.done; },
    get pending() { return frames.size; },
  };
}
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }

describe("bounded progressive geometry startup", () => {
  test("bounds in-flight/ready jobs and attaches actual results over multiple frames", async () => {
    const frames = clock(), jobs = new Map(), attached = [];
    let active = 0, peak = 0;
    const loader = createProgressiveLoader({ ...frames.options, items: Array.from({ length: 9 }, (_, i) => i), concurrency: 3,
      load: (item) => { active++; peak = Math.max(peak, active); const job = deferred(); jobs.set(item, job); return job.promise.finally(() => active--); },
      attach: (data, item) => attached.push([item, data]), maxAttachmentsPerFrame: 1 });
    loader.start(); await flush();
    expect(jobs.size).toBe(3);
    for (const job of jobs.values()) job.resolve("geometry");
    await flush();
    expect(attached).toEqual([]); // Resolved workers do not synchronously block/attach.
    expect(loader.getProgress().ready).toBe(3);
    expect(jobs.size).toBe(3); // Backpressure while ready data waits for rendering.
    await frames.frame();
    expect(attached.length).toBe(1);
    expect(jobs.size).toBe(4);
    for (let i = 0; i < 15 && loader.getProgress().status === "running"; i++) {
      for (const job of jobs.values()) job.resolve("geometry");
      await flush(); await frames.frame();
    }
    const result = await loader.done;
    expect(result.completed).toBe(9);
    expect(result.attached).toBe(9);
    expect(peak).toBeLessThanOrEqual(3);
    expect(result.peakReady).toBeLessThanOrEqual(3);
    expect(result.yields).toBe(9);
  });

  test("time budget yields between mesh attachments so other frame callbacks run", async () => {
    const frames = clock(), attached = [];
    let visibleFrames = 0;
    const loader = createProgressiveLoader({ ...frames.options, items: [0, 1, 2, 3, 4, 5], concurrency: 4, frameBudgetMs: 4,
      load: (item) => item, attach: (data) => { attached.push(data); frames.cost(5); } });
    loader.start(); await flush();
    for (let i = 0; i < 6; i++) {
      const before = attached.length;
      frames.options.requestFrame(() => visibleFrames++);
      await frames.frame();
      expect(attached.length - before).toBe(1);
    }
    expect(visibleFrames).toBe(6);
    expect((await loader.done).status).toBe("completed");
  });

  test("isolates load/attachment/fallback failures and completes remaining buildings", async () => {
    const frames = clock(), attached = [], recovered = [], errors = [];
    const loader = createProgressiveLoader({ ...frames.options, items: [0, 1, 2, 3, 4],
      load: (item) => { if (item === 1) throw new Error("worker failed"); return item; },
      attach: (_, item) => { if (item === 3) throw new Error("material failed"); attached.push(item); },
      fallback: (_, item) => { if (item === 3) throw new Error("fallback failed"); recovered.push(item); },
      onError: (error, item, context) => errors.push([item, context.phase]),
      onProgress: () => { throw new Error("broken UI observer"); } });
    loader.start(); const result = await frames.finish(loader);
    expect(attached).toEqual([0, 2, 4]);
    expect(recovered).toEqual([1]);
    expect(errors).toEqual([[1, "load"], [3, "attach"], [3, "fallback"]]);
    expect(result).toMatchObject({ completed: 5, attached: 4, successful: 3, failed: 2, fallbacks: 1, status: "completed" });
  });

  test("navigation abort settles immediately, cancels frame, discards late data, disposes once", async () => {
    const frames = clock(), jobs = [], attached = [], discarded = [], control = new AbortController();
    let disposedSource = 0, cleanup = 0;
    const loader = createProgressiveLoader({ ...frames.options, items: [0, 1, 2, 3, 4], signal: control.signal,
      load: (item, context) => { const job = deferred(); jobs.push({ item, job, signal: context.signal }); return job.promise; },
      attach: (_, item) => { attached.push(item); return () => cleanup++; },
      discard: (_, item) => discarded.push(item), disposeSource: () => disposedSource++ });
    loader.start(); await flush(); jobs[0].job.resolve("data0"); await flush(); await frames.frame();
    expect(attached).toEqual([0]);
    jobs[1].job.resolve("ready"); await flush(); expect(frames.pending).toBe(1);
    control.abort("navigation");
    expect((await loader.done).status).toBe("cancelled");
    expect(frames.pending).toBe(0);
    for (const entry of jobs) entry.job.resolve(`late${entry.item}`);
    await flush(); await frames.frame();
    expect(attached).toEqual([0]);
    expect(jobs.every((entry) => entry.signal.aborted)).toBe(true);
    expect(discarded.sort()).toEqual([1, 2, 3]);
    loader.dispose(); loader.dispose();
    expect(disposedSource).toBe(1);
    expect(cleanup).toBe(1);
    expect(loader.getProgress().cancelled).toBe(4);
  });

  test("abort with never-resolving worker does not leave the done promise pending", async () => {
    const frames = clock();
    const loader = createProgressiveLoader({ ...frames.options, items: [0, 1, 2], load: () => new Promise(() => {}), attach: () => {} });
    loader.start(); await flush(); loader.abort();
    expect(await loader.done).toMatchObject({ status: "cancelled", completed: 0, cancelled: 3 });
  });

  test("late async attachment cleanup runs after disposal, with no new work", async () => {
    const frames = clock(), attaching = deferred();
    let cleanup = 0;
    const loader = createProgressiveLoader({ ...frames.options, items: [0, 1, 2], load: (item) => item,
      attach: () => attaching.promise });
    loader.start(); await flush(); await frames.frame();
    loader.dispose(); attaching.resolve(() => cleanup++); await flush();
    expect(cleanup).toBe(1);
    expect(loader.getProgress().status).toBe("cancelled");
    expect(loader.getProgress().completed).toBe(0);
  });

  test("priority orders queued buildings stably; empty/pre-aborted starts are safe", async () => {
    const frames = clock(), order = [];
    const loader = createProgressiveLoader({ ...frames.options, items: [3, 1, 2], priority: (item) => item,
      load: (item) => { order.push(item); return item; }, attach: () => {} });
    loader.start(); await frames.finish(loader);
    expect(order).toEqual([1, 2, 3]);
    const empty = createProgressiveLoader({ ...frames.options, items: [], load: () => {}, attach: () => {} });
    expect(await empty.start()).toMatchObject({ total: 0, completed: 0, status: "completed" });
    const signal = AbortSignal.abort("already left");
    let started = false;
    const aborted = createProgressiveLoader({ ...frames.options, items: [1], signal, load: () => { started = true; }, attach: () => {} });
    expect(await aborted.start()).toMatchObject({ cancelled: 1, status: "cancelled" });
    expect(started).toBe(false);
  });
});
