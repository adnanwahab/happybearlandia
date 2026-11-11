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
const html = `<!doctype html><meta charset="utf-8"><title>Local product workflow review</title>
<h1>Local workflow review</h1><p>This stores data only on this computer. No external submission occurs.</p>
<label>Pilot brief <textarea id="brief" maxlength="4000"></textarea></label>
<label><input type="checkbox" id="consent">I consent to local storage for up to 30 days</label>
<label><input type="checkbox" id="reviewed">I reviewed this brief</label>
<button id="save">Store locally</button><button id="export">Export local records</button><button id="delete">Delete local records</button><pre id="result" role="status"></pre>
<script type="module">
let key=crypto.randomUUID();document.querySelector('#brief').oninput=()=>key=crypto.randomUUID();
async function call(method,body){const r=await fetch('/api/product-workflows',{method,headers:{'content-type':'application/json','x-local-review':'1'},body:body?JSON.stringify(body):undefined});document.querySelector('#result').textContent=JSON.stringify(await r.json(),null,2);}
document.querySelector('#save').onclick=()=>call('POST',{key,kind:'pilot',brief:document.querySelector('#brief').value,consent:document.querySelector('#consent').checked,reviewed:document.querySelector('#reviewed').checked});
document.querySelector('#export').onclick=()=>call('GET');document.querySelector('#delete').onclick=()=>call('DELETE');
</script>`;
server = Bun.serve({ hostname: '127.0.0.1', port: Number(process.env.HBL_PRODUCT_TEST_PORT || 39981), fetch: async request => await handler(request) || (new URL(request.url).pathname === '/' ? new Response(html, { headers: { 'content-type': 'text/html' } }) : new Response('Missing', { status: 404 })) });
console.log(`Local-only harness: http://127.0.0.1:${server.port}`);
