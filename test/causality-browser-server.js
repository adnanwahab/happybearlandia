// Isolated component fixture server; production dispatcher is tested separately.
import {resolve,relative} from 'node:path';
const root=resolve('.');
Bun.serve({port:39871,async fetch(request){const url=new URL(request.url);if(url.pathname.startsWith('/api/'))return Response.json({error:'Stored run not found'},{status:404});const path=resolve(root,'.'+decodeURIComponent(url.pathname));if(relative(root,path).startsWith('..'))return new Response(null,{status:404});const file=Bun.file(path);return await file.exists()?new Response(file):new Response(null,{status:404});}});
