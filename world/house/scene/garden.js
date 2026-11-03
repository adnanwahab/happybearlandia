/** Player-added garden space; source building rings are never enlarged. */
export function gardenLayout(site,bedroom={x:-3.4,z:-2.9}){
 const outer=site?.status==='mapped'?site.footprint.outer:[[-6.8,-5.8],[6.8,-5.8],[6.8,5.8],[-6.8,5.8]],minX=Math.min(...outer.map(p=>p[0]));
 let door=null;for(let i=0;i<outer.length;i++){const a=outer[i],b=outer[(i+1)%outer.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(length<1.8)continue;const t=Math.max(.85/length,Math.min(1-.85/length,((minX-a[0])*dx+(bedroom.z-a[1])*dz)/(length*length))),x=a[0]+t*dx,z=a[1]+t*dz,score=(x-minX)*10+Math.hypot(x-bedroom.x,z-bedroom.z);if(!door||score<door.score)door={edgeIndex:i,x,z,t,length,dx:dx/length,dz:dz/length,score};}
 door??={x:minX,z:bedroom.z,dx:0,dz:1};return{x:minX-3.6,z:door.z,w:6.6,d:5.6,scale:1,door,source:'Player-added garden extension; not an OSM parcel or surveyed yard'};
}
