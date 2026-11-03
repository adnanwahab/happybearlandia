import {gardenLayout} from './garden.js';
import {withinFootprint} from './footprint.js';
/** Waiting is authoritative; this access-point placement is presentation only.
 * Source outlines do not establish a surveyed door. Existing garden doorway is
 * reused when present; otherwise use the street-facing exterior edge. */
export function waitingVisitorPlacements(home,site,bedroom){const people=(home?.visitors??[]).filter(p=>p.phase==='waiting'||p.status==='waiting').slice(0,8);if(!people.length)return[];const outer=site?.footprint?.outer??[[-6.7,-5.7],[6.7,-5.7],[6.7,5.7],[-6.7,5.7]],holes=site?.footprint?.holes??[];let edge;
 if(home.rooms?.some(r=>r.id==='garden')){const d=gardenLayout(site,bedroom).door;edge={x:d.x,z:d.z,dx:d.dx,dz:d.dz};}
 else{const target=site?.street?.closestPoint??[Math.min(...outer.map(p=>p[0])),-2];let best=Infinity;for(let i=0;i<outer.length;i++){const a=outer[i],b=outer[(i+1)%outer.length],dx=b[0]-a[0],dz=b[1]-a[1],l2=dx*dx+dz*dz;if(l2<.01)continue;const t=Math.max(0,Math.min(1,((target[0]-a[0])*dx+(target[1]-a[1])*dz)/l2)),x=a[0]+t*dx,z=a[1]+t*dz,d=Math.hypot(x-target[0],z-target[1]);if(d<best){best=d;const length=Math.sqrt(l2);edge={x,z,dx:dx/length,dz:dz/length};}}}
 if(!edge)return[];let nx=-edge.dz,nz=edge.dx;if(withinFootprint([edge.x+nx*.15,edge.z+nz*.15],outer,holes)){nx=-nx;nz=-nz;}
 return people.map((person,i)=>{const side=(i%4-1.5)*.65,depth=.85+Math.floor(i/4)*.8;let x=edge.x+edge.dx*side+nx*depth,z=edge.z+edge.dz*side+nz*depth;for(let k=0;k<8&&withinFootprint([x,z],outer,holes);k++){x+=nx*.6;z+=nz*.6;}return{person,x,z,heading:Math.atan2(-nx,-nz),source:'Recorded waiting visitor; inferred exterior access-point placement, not surveyed entrance'};});
}
