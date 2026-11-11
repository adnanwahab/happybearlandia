/** Real authoritative party service with a shortened round for results tests. */
import { resolve } from 'node:path';
import { createActNormalService } from '../../world/party/act-normal-server.js';

const root = process.cwd();
const service = createActNormalService({ roundMs: 12000 });
const vendor = new Set(['three.module.js', 'three.core.js', 'three.webgpu.js', 'three.tsl.js']);

const server = Bun.serve({
  hostname: '127.0.0.1',
  port: Number(process.env.PORT ?? 3257),
  async fetch(request, server) {
    const path = new URL(request.url).pathname;
    if (path.startsWith('/api/act-normal/')) return service.fetch(request, server);
    let file;
    if (path === '/world/party/act-normal' || path === '/world/party/act-normal.html') {
      file = resolve(root, 'world/party/act-normal.html');
    } else if (path.startsWith('/vendor/three/') && vendor.has(path.split('/').at(-1))) {
      file = resolve(root, 'node_modules/three/build', path.split('/').at(-1));
    } else if (path === '/shared/causality/index.js') {
      file = resolve(root, 'shared/causality/index.js');
    } else if (path.startsWith('/world/') && /\.(?:js|css|html)$/.test(path)) {
      file = resolve(root, '.' + decodeURIComponent(path));
      if (!file.startsWith(root + '/world/')) return new Response('Not found', { status: 404 });
    }
    if (!file || !await Bun.file(file).exists()) return new Response('Not found', { status: 404 });
    return new Response(Bun.file(file));
  },
  websocket: service.websocket,
});

process.on('SIGTERM', () => {
  service.destroy();
  server.stop(true);
  process.exit(0);
});
