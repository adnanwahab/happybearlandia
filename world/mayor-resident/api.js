import {VERSION,INPUTS,POLICIES,STRATEGIES,runExercise} from './model.js';
const ROOT='/api/mayor-resident';
export function createMayorResidentHandler({now=Date.now,maxRooms=100}={}) {
  const rooms=new Map();
  const json=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store','Referrer-Policy':'no-referrer'}});
  return async request=>{
    const url=new URL(request.url),parts=url.pathname.slice(ROOT.length).split('/').filter(Boolean);
    if(url.pathname!==ROOT&&!url.pathname.startsWith(ROOT+'/'))return null;
    for(const [id,room] of rooms)if(room.expires<=now())rooms.delete(id);
    if(request.method!=='GET'&&request.headers.get('origin')&&request.headers.get('origin')!==url.origin)return json({error:'Same-origin request required'},403);
    try {
      if(request.method==='POST'&&parts.length===0){
        if(rooms.size>=maxRooms)return json({error:'Exercise capacity reached; try later'},429);
        if(await request.text()!=='{}')return json({error:'Creation accepts no custom inputs'},400);
        const id=crypto.randomUUID(),a=crypto.randomUUID(),b=crypto.randomUUID();
        rooms.set(id,{id,keys:[a,b],roles:['mayor','resident'],revision:0,policy:null,strategy:null,switchVotes:[],receipt:null,expires:now()+3600000});
        return json({id,mayorKey:a,residentKey:b},201);
      }
      const room=parts.length===1?rooms.get(parts[0]):null;
      if(!room)return json({error:'Exercise missing, expired or deleted; no results available'},404);
      const key=request.headers.get('authorization')?.replace(/^Bearer /,''),player=room.keys.indexOf(key);
      if(player<0)return json({error:'Access denied; private role key required'},403);
      const view=()=>({id:room.id,role:room.roles[player],revision:room.revision,modelVersion:VERSION,checkpoint:'exercise-household-1:month-0',inputs:INPUTS,policy:room.policy,strategy:room.strategy,switchRequested:room.switchVotes.length>0,receipt:room.receipt,expires:room.expires});
      if(request.method==='GET')return json(view());
      if(request.method==='DELETE'){rooms.delete(room.id);return json({deleted:true});}
      if(request.method!=='POST')return json({error:'Method unsupported'},405);
      const text=await request.text();if(text.length>1024)return json({error:'Request too large'},413);
      const body=JSON.parse(text);
      if(!body||Array.isArray(body)||Object.keys(body).some(k=>!['action','value','revision'].includes(k)))return json({error:'Only versioned choices accepted; outcomes cannot be submitted'},400);
      if(body.revision!==room.revision)return json({error:'Checkpoint revision changed; refresh before retrying'},409);
      const role=room.roles[player];
      if(body.action==='switch'){
        if(body.value!==undefined)return json({error:'Switch accepts no value'},400);
        if(!room.switchVotes.includes(player))room.switchVotes.push(player);
        if(room.switchVotes.length===2){room.roles.reverse();room.switchVotes=[];}
      }else{
        if(room.receipt)return json({error:'Run sealed; create another exercise to change choices'},409);
        if(body.action==='policy'){
          if(role!=='mayor')return json({error:'Mayor role required'},403);
          if(!Object.hasOwn(POLICIES,body.value))return json({error:'Unsupported intervention'},422);
          room.policy=body.value;
        }else if(body.action==='strategy'){
          if(role!=='resident')return json({error:'Resident role required'},403);
          if(!Object.hasOwn(STRATEGIES,body.value))return json({error:'Unsupported household strategy'},422);
          room.strategy=body.value;
        }else if(body.action==='run'){
          if(role!=='resident')return json({error:'Resident role required'},403);
          if(body.value!==undefined)return json({error:'Run accepts no outcomes'},400);
          if(!room.policy||!room.strategy)return json({error:'Both choices required; outcome unknown'},422);
          room.receipt={...runExercise(room.policy,room.strategy),runId:room.id,committedRevision:room.revision};
        }else return json({error:'Unsupported action'},422);
        room.switchVotes=[];
      }
      room.revision++;
      return json(view());
    }catch{return json({error:'Invalid request; no outcome claimed'},400);}
  };
}
