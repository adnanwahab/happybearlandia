// Everything recorded by the server-logs module is published at /api/server-logs,
// so redaction runs before anything reaches disk. Callers never pass IPs, query
// strings, headers, cookies or request bodies; free text is scrubbed of emails,
// secrets, network addresses, coordinates and identifiers.

export const MAX_MESSAGE = 500;

const URL_WITH_QUERY = /\b(https?:\/\/[^\s?#"'<>]+)[?#][^\s"'<>]*/gi;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const SECRET_PAIR = /\b(authorization|cookie|token|secret|password|passwd|api[_-]?key|access[_-]?key|session|signature|credential)(s?\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,;&)}\]]+)/gi;
const COORDINATE_PAIR = /-?\d{1,3}\.\d{3,}\s*,\s*-?\d{1,3}\.\d{3,}/g;
const COORDINATE_FIELD = /\b(lat|lng|lon|latitude|longitude)\b(\s*[:=]?\s*)-?\d{1,3}(?:\.\d+)?/gi;
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const IPV6_CANDIDATE = /(?<![\w:.])[0-9A-Fa-f]{0,4}(?::[0-9A-Fa-f]{0,4}){2,7}(?![\w:])/g;
const HEX_ID = /\b[0-9a-f]{16,}\b/gi;
const MIXED_TOKEN = /\b(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{20,}\b/g;
const LONG_NUMBER = /\b\d{9,}\b/g;
const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f]/g;

// Clock times such as 12:30:45 have colons too; an address needs a hex letter or "::".
const looksLikeIpv6 = text => (text.match(/:/g) || []).length >= 2 && (text.includes('::') || /[a-f]/i.test(text));

export function redactText(value, max = MAX_MESSAGE) {
  const text = String(value ?? '')
    .replace(CONTROL, ' ')
    .replace(URL_WITH_QUERY, '$1?[redacted]')
    .replace(EMAIL, '[email]')
    .replace(BEARER, 'Bearer [redacted]')
    .replace(SECRET_PAIR, '$1$2[redacted]')
    .replace(COORDINATE_PAIR, '[coordinates]')
    .replace(COORDINATE_FIELD, '$1$2[coordinate]')
    .replace(UUID, '[id]')
    .replace(IPV4, '[ip]')
    .replace(IPV6_CANDIDATE, match => looksLikeIpv6(match) ? '[ip]' : match)
    .replace(HEX_ID, '[id]')
    .replace(MIXED_TOKEN, '[token]')
    .replace(LONG_NUMBER, '[number]');
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

// Routes whose segments after the prefix are record IDs, share codes, room codes or
// player-chosen text. Every such segment is replaced unless it is a known action word
// or a static file name.
const PRIVATE_SEGMENT_PREFIXES = [
  '/r/', '/world/date/', '/world/house/', '/github/previews/',
  '/api/reality-shares/', '/api/world-homes/', '/api/world-experiments/', '/api/world-history/',
  '/api/runs/', '/api/experiments/', '/api/city-experiments/', '/api/world/experiments/',
  '/api/decision-experiments/', '/api/decision-optimizations/', '/api/act-normal/rooms/',
];
const ACTION_WORDS = new Set(['fork', 'restore', 'date-media', 'house-session', 'image', 'cancel', 'pause',
  'resume', 'status', 'result', 'results', 'events', 'trace', 'vote', 'compare', 'export']);
const STATIC_FILE = /\.(?:js|mjs|cjs|css|html?|json|map|png|jpe?g|gif|svg|webp|avif|ico|wasm|glb|gltf|bin|ktx2|hdr|mp3|wav|ogg|mp4|webm|txt|csv|geojson|woff2?|ttf|otf|pdf|md)$/i;
const UUID_EXACT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PATH = 200;
const MAX_SEGMENTS = 16;

function decode(segment) {
  try { return decodeURIComponent(segment); } catch { return segment; }
}

function privateSegment(segment) {
  const text = decode(segment);
  return ACTION_WORDS.has(text) || (STATIC_FILE.test(text) && !/[@\s]/.test(text)) ? segment : ':id';
}

function publicSegment(segment) {
  const text = decode(segment);
  if (text.length > 64 || /[@\s]/.test(text)) return ':id';
  if (STATIC_FILE.test(text)) return segment;
  if (UUID_EXACT.test(text) || /^[0-9a-f]{16,}$/i.test(text) || /^\d{4,}$/.test(text)) return ':id';
  const digits = /\d/.test(text);
  if (digits && /[A-Za-z]/.test(text) && text.length >= 16) return ':id';
  if (digits && /[a-z]/.test(text) && /[A-Z]/.test(text) && text.length >= 8) return ':id';
  return segment;
}

// Keep the route shape (useful for finding broken links and failing handlers) while
// dropping query strings, fragments and anything that identifies a record or player.
export function normalizePath(input) {
  let path = String(input ?? '/');
  const cut = path.search(/[?#]/);
  if (cut >= 0) path = path.slice(0, cut);
  if (!path.startsWith('/')) path = '/' + path;
  const prefix = PRIVATE_SEGMENT_PREFIXES.find(candidate => path.startsWith(candidate));
  const fixed = prefix ? prefix.split('/').length - 2 : Infinity;
  const segments = path.split('/').slice(1);
  const kept = segments.slice(0, MAX_SEGMENTS).map((segment, index) => {
    if (!segment) return segment;
    return index >= fixed ? privateSegment(segment) : publicSegment(segment);
  });
  if (segments.length > MAX_SEGMENTS) kept.push('…');
  const normalized = '/' + kept.join('/');
  return normalized.length > MAX_PATH ? normalized.slice(0, MAX_PATH - 1) + '…' : normalized;
}
