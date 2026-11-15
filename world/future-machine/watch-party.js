import {validateLanding} from './share/index.js';

export function presentation(input) {
  if (!input || Object.keys(input).sort().join() !== 'landing,month' ||
      !Number.isInteger(input.month) || input.month < 0 || input.month > 120) throw Error('Invalid presentation');
  return {month:input.month,landing:validateLanding(input.landing)};
}
// Capability rooms contain presentation only. No City API, store or model import.
export function createWatchPartyService({enabled=false,now=Date.now,ttl=30*60*1000,maxRooms=32}={}) {
  const rooms=new Map();
  const token=()=>crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
  const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
  const fail=(text,status)=>reply({error:text},status);
  function sweep(){for(const [key,room] of rooms)if(now()-room.created>=ttl)rooms.delete(key);}
  const cleanup=enabled?setInterval(sweep,Math.min(ttl,1000)):null;cleanup?.unref?.();
  async function read(request){
    const reader=request.body?.getReader();let text='',size=0;const decoder=new TextDecoder();
    if(reader)while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();throw Error('Message too large');}text+=decoder.decode(value,{stream:true});}
    return JSON.parse(text+decoder.decode());
  }
  return {destroy(){if(cleanup)clearInterval(cleanup);rooms.clear();},async fetch(request){
    if(!enabled)return fail('Watch party is unavailable on this server',503);
    const url=new URL(request.url);
    if(request.headers.get('origin')&&request.headers.get('origin')!==url.origin)return fail('Same origin required',403);
    sweep();
    try {
      if(url.pathname==='/api/future-watch/rooms'&&request.method==='POST'){
        if(rooms.size>=maxRooms)return fail('Watch party capacity reached',503);
        const data=await read(request);
        if(Object.keys(data).sort().join()!=='receipt,view'||!/^[a-f0-9]{64}$/.test(data.receipt))throw Error('Invalid receipt');
        const host=token(),invite=token();
        rooms.set(invite,{host,receipt:data.receipt,view:presentation(data.view),revision:0,reactions:[],created:now(),lastWrite:-Infinity});
        return reply({invite,host},201);
      }
      const capability=request.headers.get('authorization')?.replace(/^Bearer /,'');
      const room=rooms.get(capability)||[...rooms.values()].find(row=>row.host===capability);
      if(!room)return fail('Party missing or expired; create a new invitation',404);
      if(url.pathname!=='/api/future-watch/state')return fail('Unknown watch party endpoint',404);
      if(request.method==='GET')return reply({receipt:room.receipt,view:room.view,revision:room.revision,reactions:room.reactions});
      if(request.method==='DELETE'&&capability===room.host){for(const [key,row] of rooms)if(row===room)rooms.delete(key);return reply({ended:true});}
      if(request.method!=='POST')return fail('Unsupported method',405);
      const data=await read(request);
      if(now()-room.lastWrite<80)return fail('Updates too frequent',429);
      if(Object.keys(data).join()==='reaction'&&['heart','wow','question'].includes(data.reaction)){
        room.reactions=[...room.reactions.slice(-7),{kind:data.reaction,at:now()}];
      }else{
        if(capability!==room.host)return fail('Only host can publish presentation',403);
        room.view=presentation(data);room.revision++;
      }
      room.lastWrite=now();return reply({ok:true});
    }catch{return fail('Invalid watch party message',400);}
  }};
}
