// Isolated static harness; no application routes, credentials or model runtime.
import { resolve, sep } from 'node:path';
const root=resolve(import.meta.dir,'../../..'),three=resolve(root,'node_modules/three');
Bun.serve({hostname:'127.0.0.1',port:Number(process.env.XRAY_PORT||41053),async fetch(request){
 let path;try{path=decodeURIComponent(new URL(request.url).pathname);}catch{return new Response('Bad path',{status:400});}
 let base,relative;
 if(path.startsWith('/vendor/three/')){base=three;relative=path.slice(14);}
 else if(path.startsWith('/world/city-xray/')||path==='/world/camera-presets.js'){base=root;relative=path.slice(1);}
 else return new Response('Not found',{status:404});
 const target=resolve(base,relative);if(!target.startsWith(base+sep))return new Response('Not found',{status:404});
 const file=Bun.file(target);return await file.exists()?new Response(file):new Response('Not found',{status:404});
}});
