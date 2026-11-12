// Trusted root-owned front door. Selected app runs as a different UID on3001.
const CSP="default-src 'self' data: blob: https://cdn.jsdelivr.net https://unpkg.com https://esm.sh; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' blob: https://cdn.jsdelivr.net https://unpkg.com https://esm.sh; connect-src 'self'; worker-src 'self' blob:; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
const server=Bun.serve({port:3000,hostname:'0.0.0.0',async fetch(request,server){
 const url=new URL(request.url),headers=new Headers(request.headers);
 if(url.pathname==='/__hbl_gateway')return Response.json({gateway:'hbl-secretless-bun-v1'});
 for(const name of ['authorization','cookie','proxy-authorization','forwarded','x-forwarded-host','x-forwarded-for'])headers.delete(name);
 headers.set('host','127.0.0.1:3001');
 if(headers.get('upgrade')?.toLowerCase()==='websocket'){
  if(request.headers.get('origin')!==url.origin)return new Response('Origin mismatch',{status:403});
  if(server.upgrade(request,{data:{path:url.pathname+url.search,queue:[],bytes:0}}))return;
  return new Response('Upgrade failed',{status:400});
 }
 try{const response=await fetch('http://127.0.0.1:3001'+url.pathname+url.search,{method:request.method,headers,body:['GET','HEAD'].includes(request.method)?undefined:request.body,redirect:'manual',signal:AbortSignal.timeout(30000)});
 const out=new Headers(response.headers);for(const name of ['set-cookie','access-control-allow-origin','fly-replay'])out.delete(name);
 out.set('content-security-policy',CSP);out.set('referrer-policy','no-referrer');out.set('x-content-type-options','nosniff');out.set('cross-origin-resource-policy','same-origin');return new Response(response.body,{status:response.status,headers:out});
 }catch{return new Response('Isolated backend unavailable',{status:502});}
},websocket:{open(socket){const peer=new WebSocket('ws://127.0.0.1:3001'+socket.data.path);socket.data.peer=peer;peer.binaryType='arraybuffer';peer.onopen=()=>{for(const message of socket.data.queue)peer.send(message);socket.data.queue=[];};peer.onmessage=e=>socket.send(e.data);peer.onerror=()=>socket.close();peer.onclose=()=>socket.close();},message(socket,message){if(socket.data.peer?.readyState===1)socket.data.peer.send(message);else{socket.data.bytes+=typeof message==='string'?message.length:message.byteLength;if(socket.data.bytes>65536)socket.close(1009);else socket.data.queue.push(message);}},close(socket){socket.data.peer?.close();}}});
