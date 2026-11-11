// Local manual browser harness only; never mount this route on the application server.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createProductWorkflowStore, createProductWorkflowHandler } from './index.js';
const directory = process.env.HBL_PRODUCT_TEST_STORE || mkdtempSync(join(tmpdir(), 'hbl-product-browser-'));
const store = createProductWorkflowStore({ directory });
let server;
const handler = createProductWorkflowHandler({ store, authorize: request => {
  const origin = new URL(request.url).origin;
  if (request.headers.get('origin') && request.headers.get('origin') !== origin) return null;
  return request.headers.get('x-local-review') === '1' ? 'local-review' : null;
} });
const html = `<!doctype html><meta charset="utf-8"><title>Local product workflow review</title><main></main>
<script type="module">import {mountProductWorkflows} from '/ui.js';mountProductWorkflows(document.querySelector('main'),{headers:{'x-local-review':'1'}});</script>`;
server = Bun.serve({ hostname: '127.0.0.1', port: Number(process.env.HBL_PRODUCT_TEST_PORT || 39981), fetch: async request => (new URL(request.url).pathname === '/ui.js' ? new Response(Bun.file(new URL('./ui.js', import.meta.url)), {headers:{'content-type':'text/javascript'}}) : await handler(request)) || (new URL(request.url).pathname === '/' ? new Response(html, { headers: { 'content-type': 'text/html' } }) : new Response('Missing', { status: 404 })) });
console.log(`Local-only harness: http://127.0.0.1:${server.port}`);
