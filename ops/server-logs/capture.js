import { normalizePath, redactText } from './redact.js';

export const SLOW_REQUEST_MS = 1500;
const HEALTH_PATHS = new Set(['/api/health', '/api/ready', '/api/demo/ready']);
const LOGS_PATH = '/api/server-logs';
const METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
const STACK_FRAMES = 6;

export function classifyRequest(request, pathname) {
  if ((request.headers.get('upgrade') || '').toLowerCase() === 'websocket') return 'websocket';
  if (pathname.startsWith('/api/')) return 'api';
  const destination = request.headers.get('sec-fetch-dest');
  if (destination === 'document') return 'page';
  if (!destination && (request.headers.get('accept') || '').includes('text/html')) return 'page';
  return 'asset';
}

// Keep what explains player experience (pages, API calls, failures, slow responses)
// and skip high-volume noise: successful static assets, health probes and this endpoint.
export function shouldRecordRequest({ kind, path, status, ms }, slowMs = SLOW_REQUEST_MS) {
  if (path === LOGS_PATH) return status >= 500;
  if (HEALTH_PATHS.has(path)) return status >= 400;
  if (status >= 400 || ms >= slowMs) return true;
  return kind !== 'asset';
}

const methodOf = request => METHODS.has(request?.method) ? request.method : 'OTHER';
const errorName = error => {
  const name = typeof error?.name === 'string' ? error.name.replace(/[^\w.$-]/g, '').slice(0, 60) : '';
  return name || 'Error';
};
function errorMessage(error) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try { return JSON.stringify(error) ?? String(error); } catch { return String(error); }
}
function stackFrames(error, appRoot) {
  if (typeof error?.stack !== 'string') return [];
  const root = appRoot.endsWith('/') ? appRoot : appRoot + '/';
  return error.stack.split('\n').map(line => line.trim()).filter(line => line.startsWith('at ')).slice(0, STACK_FRAMES)
    .map(line => redactText(line.split(root).join('').replace(/file:\/\//g, ''), 200));
}
function formatArg(value) {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return `${errorName(value)}: ${value.message}`;
  if (value && typeof value === 'object') {
    if (typeof value.message === 'string') return value.message;
    try {
      const text = JSON.stringify(value);
      if (text && text !== '{}') return text.slice(0, 300);
    } catch {}
    return Object.prototype.toString.call(value);
  }
  return String(value);
}

export function createServerLogRecorder(store, options = {}) {
  const slowMs = options.slowMs ?? SLOW_REQUEST_MS;
  const appRoot = options.appRoot ?? process.cwd();
  return {
    request(request, pathname, status, ms) {
      const kind = classifyRequest(request, pathname);
      const path = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
      if (!shouldRecordRequest({ kind, path, status, ms }, slowMs)) return false;
      const slow = ms >= slowMs;
      return store.record({
        level: status >= 500 ? 'error' : status >= 400 || slow ? 'warn' : 'info',
        type: 'request', kind, method: methodOf(request), path: normalizePath(pathname), status,
        ms: Math.round(ms), ...(slow ? { slow: true } : {}),
      });
    },
    exception(error, request, pathname) {
      return store.record({
        level: 'error', type: 'exception', method: methodOf(request), path: normalizePath(pathname),
        name: errorName(error), message: redactText(errorMessage(error)), stack: stackFrames(error, appRoot),
      });
    },
    console(level, args) {
      const message = redactText(args.map(formatArg).join(' '));
      if (!message.trim()) return false;
      return store.record({ level, type: 'console', message });
    },
    lifecycle(message, details = {}) {
      return store.record({ level: 'info', type: 'lifecycle', message: redactText(message, 200), ...details });
    },
  };
}

const safely = action => {
  try { action(); } catch {}
};

// Wraps the Bun.serve fetch handler. Responses and thrown errors pass through
// unchanged; a successful WebSocket upgrade returns no Response and is logged as 101.
export function instrumentFetch(handler, recorder, clock = () => performance.now()) {
  return async function fetchWithServerLogs(request, server) {
    const started = clock();
    let pathname = '/';
    try { pathname = new URL(request.url).pathname; } catch {}
    let response;
    try {
      response = await handler.call(this, request, server);
    } catch (error) {
      safely(() => recorder.exception(error, request, pathname));
      safely(() => recorder.request(request, pathname, 500, clock() - started));
      throw error;
    }
    safely(() => recorder.request(request, pathname, response ? response.status : 101, clock() - started));
    return response;
  };
}

// Mirrors console.error and console.warn into the log. Output still prints as before,
// and a re-entrancy guard keeps a failing write from looping back into the console.
export function captureConsole(recorder, target = console) {
  const originals = {};
  let busy = false;
  for (const level of ['error', 'warn']) {
    const original = target[level];
    if (typeof original !== 'function' || original.serverLogsCapture) continue;
    originals[level] = original;
    const capture = (...args) => {
      const result = original.apply(target, args);
      if (!busy) {
        busy = true;
        try { recorder.console(level, args); } catch {} finally { busy = false; }
      }
      return result;
    };
    capture.serverLogsCapture = true;
    target[level] = capture;
  }
  return () => {
    for (const [level, original] of Object.entries(originals)) target[level] = original;
  };
}
