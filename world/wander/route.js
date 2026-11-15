import {hashSeed} from '../gen.js';

// wander.v1 is cosmetic: the procedural generator's 86m grid has 16m streets.
// Sourced/saved geometry has no validated walkability contract; fail closed.
export function createWanderRoute(town, {seed=town?.seedKey, round=0, rendered=()=>true}={}) {
  if(town?.source!=='procedural')return null;
  const buildings=town.buildings??[];
  if(!buildings.length||buildings.some(b=>b.state?.flooded||b.blocked))return null;
  const offset=hashSeed(`${seed}|wander.v1|${round}`)%64;
  const point=(x,z)=>({x,z});
  for(let attempt=0;attempt<64;attempt++){
    const cell=(offset+attempt)%64,x=(cell%8-4)*86-8,z=(Math.floor(cell/8)-4)*86-8;
    const points=[point(x,z),point(x+86,z),point(x+86,z+86),point(x,z+86)];
    const segments=points.map((p,i)=>[p,points[(i+1)%4]]);
    // Every segment must lie on an actually loaded street and clear every footprint.
    const safe=segments.every(([a,b])=>(town.roads??[]).some(r=>r.pts?.some((p,i)=>{
      const q=r.pts[i+1];if(!q)return false;
      return a.x===b.x&&p[0]===a.x&&q[0]===a.x&&Math.min(p[1],q[1])<=Math.min(a.z,b.z)&&Math.max(p[1],q[1])>=Math.max(a.z,b.z)
        ||a.z===b.z&&p[1]===a.z&&q[1]===a.z&&Math.min(p[0],q[0])<=Math.min(a.x,b.x)&&Math.max(p[0],q[0])>=Math.max(a.x,b.x);
    }))&&!buildings.some(building=>{
      if(!building.poly?.length)return true;
      const xs=building.poly.map(p=>p[0]),zs=building.poly.map(p=>p[1]);
      return Math.max(a.x,b.x)>=Math.min(...xs)&&Math.min(a.x,b.x)<=Math.max(...xs)&&Math.max(a.z,b.z)>=Math.min(...zs)&&Math.min(a.z,b.z)<=Math.max(...zs);
    }));
    if(!safe)continue;
    const used=new Set(),stops=[];
    for(const p of points){
      const nearby=buildings.filter(b=>!used.has(b.id)&&rendered(b)&&b.center?.every(Number.isFinite)).sort((a,b)=>Math.hypot(a.center[0]-p.x,a.center[1]-p.z)-Math.hypot(b.center[0]-p.x,b.center[1]-p.z)||String(a.id).localeCompare(String(b.id)));
      const b=nearby[0];if(!b||Math.hypot(b.center[0]-p.x,b.center[1]-p.z)>80)break;
      used.add(b.id);stops.push({...p,landmarkId:b.id,label:`Synthetic ${b.kind} · ${b.id}`});
    }
    if(stops.length===4)return {version:'wander.v1',seed:String(seed),round,stops};
  }
  return null;
}

export function createWanderController({getRoute,move,onChange=()=>{},manual=()=>false}) {
  let route=null,index=0,elapsed=0,last=null,started=null,reason='idle';
  const state=()=>({active:!!route,index,route,reason});
  function stop(why='interrupted'){route=null;last=null;reason=why;onChange(state());}
  function valid(){const current=getRoute();return current&&JSON.stringify(current)===JSON.stringify(route);}
  function show(){move(route.stops[index]);onChange(state());}
  function next(){if(!route)return;if(!valid()){stop('unavailable');return;}if(++index>=4){stop('complete');return;}elapsed=0;last=null;show();}
  return {getState:state,stop,next,start(){route=getRoute();index=0;elapsed=0;last=null;started=null;reason=route?'wandering':'unavailable';if(route)show();else onChange(state());return !!route;},update(now){
    if(!route)return;
    if(!valid()){stop('unavailable');return;}
    if(manual()){last=null;elapsed=0;return;}
    started??=now;if(now-started>=24000){stop('complete');return;}
    if(last!==null)elapsed+=Math.max(0,Math.min(100,now-last));last=now;
    const a=route.stops[index],b=route.stops[(index+1)%4],t=Math.min(1,elapsed/6000);
    move({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});if(t===1)next();
  }};
}
