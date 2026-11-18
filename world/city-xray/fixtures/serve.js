// Focused diagnostic harness only; never starts the application or a simulation.
import { resolve } from 'node:path';
const root=resolve(import.meta.dir,'../../..');
Bun.serve({hostname:'127.0.0.1',port:41045,async fetch(request){const path=decodeURIComponent(new URL(request.url).pathname);if(!path.startsWith('/world/city-xray/')||path.includes('..'))return new Response('Not found',{status:404});const file=Bun.file(resolve(root,`.${path}`));return await file.exists()?new Response(file):new Response('Not found',{status:404});}});
