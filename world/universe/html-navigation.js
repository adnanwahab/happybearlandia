import { EXPERIENCES } from './registry.js';

export const BOOTSTRAP_PATH = '/world/universe/app-bootstrap.js';
const bootstrapTag = `<script type="module" src="${BOOTSTRAP_PATH}"></script>`;
const origin = 'http://hbl.local';
const fileOverrides = Object.freeze({
  world: 'world/index.html',
  'living-city': 'world/index.html',
  'constitution-city': 'world/constitution-city.html',
  game: 'game/index.html',
  house: 'world/house/index.html',
  experiments: 'world/reality-compiler.html',
  business: 'world/business.html',
});

function experienceFile(app) {
  if (fileOverrides[app.id]) return fileOverrides[app.id];
  const path = new URL(app.route, origin).pathname.slice(1);
  return path.endsWith('/') ? path + 'index.html' : path.endsWith('.html') ? path : path + '.html';
}
const files = new Set(EXPERIENCES.map(experienceFile));
/** Project-relative document paths only: never match HTML by a loose URL prefix. */
export function registeredHTMLFiles() { return [...files]; }
export function isRegisteredHTMLFile(path) {
  return files.has(path.replace(/^\.\//, ''));
}

function canonicalPath(path) {
  return path.replace(/\/index\.html$/, '').replace(/\.html$/, '').replace(/\/$/, '') || '/';
}
const aliases = new Map([
  ['/world/visualize-consitution', '/visualize-constitution'],
  ['/world/visualize-constitution', '/visualize-constitution'],
  ['/world/reality-compiler', '/reality-compiler'],
  ['/world/business', '/business-simulator'],
  ['/change', '/reality-compiler'],
  ['/city-speaks', '/reality-compiler'],
]);
/** Match supported documents and known server aliases without labeling unrelated routes. */
export function experienceFromLocation(input) {
  let url;
  try {
    url = new URL(typeof input === 'string' ? input : input.href, origin);
    url.pathname = decodeURIComponent(url.pathname);
  } catch { return null; }
  let path = canonicalPath(url.pathname);
  if (path === '/') return null; // The shell owns its own navigation.
  path = aliases.get(path) || path;
  if (/^\/r\/[A-Za-z0-9_-]{8,16}$/.test(path)) path = '/reality-compiler';
  if (/^\/world\/house\/[A-Za-z0-9_-]{1,80}$/.test(path)) path = '/world/house';
  if (/^\/world\/bench\/(aerial-city|downtown|construction|rush-hour|night|rain)$/.test(path)) path = '/world';
  // The game server deliberately serves its document for extensionless SPA routes.
  if (/^\/game\//.test(path) && !/\.[^/]+$/.test(url.pathname)) path = '/game';
  const matches = EXPERIENCES.filter(app => {
    const route = new URL(app.route, origin);
    if (canonicalPath(route.pathname) !== path) return false;
    if (route.hash && route.hash !== url.hash) return false;
    return [...route.searchParams].every(([key, value]) => url.searchParams.get(key) === value);
  });
  matches.sort((a, b) => {
    const specificity = app => { const route = new URL(app.route, origin); return route.searchParams.size + (route.hash ? 1 : 0); };
    return specificity(b) - specificity(a);
  });
  return matches[0] || null;
}

/** Idempotent HTML-only transform; source documents stay untouched. */
export function injectUniverseBootstrap(html, path) {
  if (!isRegisteredHTMLFile(path) || /<script\b[^>]*\bsrc\s*=\s*['"]\/world\/universe\/app-bootstrap\.js['"]/i.test(html)) return html;
  return /<\/body\s*>/i.test(html) ? html.replace(/<\/body\s*>/i, bootstrapTag + '\n$&') : html + '\n' + bootstrapTag;
}

/** Preserve serving metadata while changing only registered HTML response bodies. */
export async function withUniverseNavigation(response, path) {
  if (response.status !== 200 || !isRegisteredHTMLFile(path)) return response;
  const html = await response.text();
  const headers = new Headers(response.headers);
  // Bun normally infers the file MIME when sending; the string body needs it explicitly.
  if (!headers.has('content-type')) headers.set('content-type', 'text/html; charset=utf-8');
  headers.delete('content-length');
  return new Response(injectUniverseBootstrap(html, path), { status: response.status, statusText: response.statusText, headers });
}
