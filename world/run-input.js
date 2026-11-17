// Public /api/runs preflight. Limits apply before generation, hashing or scheduling.
export const RUN_INPUT_LIMITS = Object.freeze({
  bytes: 4_000_000, array: 100_000, nodes: 250_000, depth: 32, errorChars: 240,
});

function invalid(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

export async function readRunInput(request) {
  if (Number(request.headers.get('content-length')) > RUN_INPUT_LIMITS.bytes) invalid('Run request too large', 413);
  const reader = request.body?.getReader();
  if (!reader) invalid('Run request requires JSON');
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > RUN_INPUT_LIMITS.bytes) {
        await reader.cancel();
        invalid('Run request too large', 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { invalid('Run request must contain valid JSON'); }
}

export function validateRunInput(value) {
  const stack = [[value, 0, '']];
  let nodes = 0;
  while (stack.length) {
    const [item, depth, key] = stack.pop();
    if (++nodes > RUN_INPUT_LIMITS.nodes || depth > RUN_INPUT_LIMITS.depth) invalid('Run input exceeds complexity limit');
    if (typeof item === 'number' && !Number.isFinite(item)) invalid('Run input numbers must be finite');
    if (['createdAt', 'updatedAt', 'timestamp'].includes(key)) {
      if (typeof item !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(item) || !Number.isFinite(Date.parse(item)) || new Date(item).toISOString() !== item) invalid('Run input timestamp must be a valid UTC ISO timestamp');
    }
    if (item && typeof item === 'object') {
      if (Array.isArray(item) && item.length > RUN_INPUT_LIMITS.array) invalid('Run input array exceeds limit');
      const entries = Object.entries(item);
      if (nodes + stack.length + entries.length > RUN_INPUT_LIMITS.nodes) invalid('Run input exceeds complexity limit');
      for (const [childKey, child] of entries) stack.push([child, depth + 1, childKey]);
    }
  }
}
