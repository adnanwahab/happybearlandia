/** Worker protocol v1. The registry observes actual workers; no fake heartbeats,
 * portable per-worker memory is unavailable. All history and queues are bounded.
 * Pool tasks: {id,kind,payload,priority,deterministic,retries}. Only explicitly
 * deterministic tasks may replay after a crash, with identical payload/seed.
 */
export const WORKER_PROTOCOL = "hbl-worker.v1";
export const WORKER_MESSAGES = Object.freeze(["WORKER_HELLO","WORKER_READY","TASK_START","TASK_PROGRESS","TASK_DONE","TASK_ERROR","WORKER_HEARTBEAT","WORKER_SHUTDOWN"]);
export const WORKER_LIMITS = Object.freeze({ workers: 12, queue: 128, history: 120, messages: 80, errors: 24, retries: 1, heartbeatMs: 2000, staleMs: 10000 });
export function stableRanges(count, partitions = 12) {
  const total = Math.max(0, Math.floor(count)); const n = Math.max(1, Math.min(12, Math.floor(partitions), total || 1));
  return Array.from({length:n}, (_,index) => ({ index, start:Math.floor(index*total/n),end:Math.floor((index+1)*total/n) }));
}
