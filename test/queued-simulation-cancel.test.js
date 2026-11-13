import { test, expect } from 'bun:test';
import { createWorkerPool } from '../world/workers/priority-pool.js';
import { createPopulationStudioRunner } from '../world/population/studio.js';

const url = new URL('./fixtures/pool-test.worker.js', import.meta.url);

test('studio cancellation invalidates queued replacements and late active completion while preserving displayed results', async () => {
  let finish, starts = 0, cancels = 0;
  const runner = createPopulationStudioRunner({}, () => {
    starts++;
    return { ready: new Promise(resolve => { finish = resolve; }), cancel() { cancels++; } };
  });
  let displayed = 'saved result';
  const publish = request => runner.run(request).then(value => { displayed = value; }, error => error.message);
  const active = publish({ seed: 42 });
  const queued = publish({ seed: 42 });
  runner.cancel();
  finish('late cancelled result');
  expect(await active).toContain('superseded');
  expect(await queued).toContain('superseded');
  expect(starts).toBe(1);
  expect(cancels).toBe(2);
  expect(displayed).toBe('saved result');
  const replacement = publish({ seed: 42 });
  finish('replacement result');
  await replacement;
  expect(starts).toBe(2);
  expect(displayed).toBe('replacement result');
});

test('cancelled pending simulation releases admission capacity and never publishes a result', async () => {
  const pool = createWorkerPool({ url, size: 1, maxQueue: 1 });
  const previous = { seed: 42, value: 'saved result' };
  let displayed = previous;
  try {
    pool.pause();
    const pending = pool.submit({ id: 'pending', kind: 'echo', payload: { value: 'cancelled result' } });
    const settled = pending.then(value => { displayed = value; }, error => error.message);
    await expect(pool.submit({ kind: 'echo' })).rejects.toThrow('full');
    expect(pool.cancel('pending')).toBe(true);
    expect(pool.snapshot().queueDepth).toBe(0);
    expect(pool.cancel('pending')).toBe(false);
    expect(await settled).toBe('Task cancelled');
    await pool.drain();
    expect(displayed).toBe(previous);
    const replacement = pool.submit({ id: 'replacement', kind: 'echo', payload: { value: 'new result' } });
    pool.resume();
    displayed = await replacement;
    await pool.drain();
    expect(displayed).toBe('new result');
    expect(pool.snapshot().completed).toBe(1);
    expect(pool.snapshot().failed).toBe(0);
  } finally { pool.destroy(); }
});

test('late events from cancelled workers cannot consume restart budget or overwrite replacement results', async () => {
  const workers = [];
  const workerFactory = () => {
    const listeners = {};
    const worker = {
      addEventListener(type, callback) { listeners[type] = callback; },
      postMessage(message) { worker.message = message; },
      terminate() {},
      emit(type, event) { listeners[type]?.(event); },
    };
    workers.push(worker);
    return worker;
  };
  const pool = createWorkerPool({ url, size: 1, workerFactory });
  let displayed = 'previous result';
  try {
    const pending = pool.submit({ id: 'run', kind: 'echo', deterministic: true });
    const settled = pending.then(value => { displayed = value; }, error => error.message);
    const retired = workers[0];
    expect(pool.cancel('run')).toBe(true);
    expect(await settled).toBe('Task cancelled');
    const replacement = pool.submit({ id: 'run', kind: 'echo' });
    for (let index = 0; index < 5; index++) retired.emit('error', { message: 'late crash' });
    retired.emit('message', { data: { taskId: 'run', type: 'TASK_DONE', result: 'stale result' } });
    expect(displayed).toBe('previous result');
    expect(pool.snapshot().paused).toBe(false);
    expect(workers).toHaveLength(2);
    workers[1].emit('message', { data: { taskId: 'run', type: 'TASK_DONE', result: 'replacement result' } });
    displayed = await replacement;
    await pool.drain();
    expect(displayed).toBe('replacement result');
    expect(pool.snapshot().completed).toBe(1);
    expect(pool.snapshot().failed).toBe(0);
  } finally { pool.destroy(); }
});
