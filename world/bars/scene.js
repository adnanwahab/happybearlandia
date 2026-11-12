/** Isometric low-fidelity venue scene. Exterior geometry is OSM only when verified. */
import {projector} from '../gen.js';

export function ringContains([lat,lng],ring) {
  if(!Array.isArray(ring)||ring.length<3)return false;
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];if(!Array.isArray(a)||!Array.isArray(b))continue;
    if((a[0]>lat)!==(b[0]>lat) && lng<(b[1]-a[1])*(lat-a[0])/(b[0]-a[0])+a[1])inside=!inside;
  }
  return inside;
}

export function findVenueFootprint(venue,area){
  if(!venue||!Array.isArray(area?.buildings))return null;
  const valid=b=>Array.isArray(b?.pts)&&b.pts.length>=3&&b.pts.every(p=>Array.isArray(p)&&p.length>=2&&p.slice(0,2).every(Number.isFinite));
  if(venue.osmType==='way'){
    const exact=area.buildings.find(b=>valid(b)&&b.id==='w'+venue.osmId);
    if(exact)return {building:exact,confidence:'matched OSM way ID',source:'osm-exact-way'};
  }
  const candidates=area.buildings.filter(b=>valid(b)&&ringContains([venue.lat,venue.lng],b.pts));
  if(candidates.length===1)return{building:candidates[0],confidence:'venue coordinate within one OSM building polygon; tenancy unverified',source:'osm-containing-polygon'};
  return null; // Never borrow the nearest unrelated footprint.
}

const coord=(venue,pts)=>{
  const proj=projector({lat:venue.lat,lng:venue.lng});
  return pts.map(([lat,lng])=>proj.toXZ(lat,lng)).filter(p=>p.every(Number.isFinite));
};
export function venueSceneGeometry(venue,match){
  if(!match?.building)return{footprint:[[-15,-11],[15,-11],[15,11],[-15,11]],levels:1,source:'illustrative',confidence:'No verified venue building footprint; schematic geometry only'};
  const points=coord(venue,match.building.pts);
  if(points.length>3&&Math.hypot(points[0][0]-points.at(-1)[0],points[0][1]-points.at(-1)[1])<.1)points.pop();
  const levels=Number(match.building.levels??venue.levels);
  return{footprint:points.length>=3?points:[[-15,-11],[15,-11],[15,11],[-15,11]],
    levels:Number.isFinite(levels)?Math.max(1,Math.min(15,levels)):1,
    source:match.source,confidence:match.confidence};
}

export function mountBarScene(canvas,{venue,geometry,patrons=[],onPatronSelect=()=>{}}={}) {
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas2D is unavailable');
  let destroyed=false,selectedId=null,frame=null,angle=.52,paused=false,clock=0,zoom=1;
  const spots=patrons.map((p,i)=>({id:p.id,x:Math.cos(i*2.399)*7,z:Math.sin(i*2.399)*5,color:p.look?.shirt||'#eacb8a'}));
  const floor=geometry?.footprint?.length>=3?geometry.footprint:[[-15,-11],[15,-11],[15,11],[-15,11]];
  let bounds=floor.reduce((a,p)=>({minX:Math.min(a.minX,p[0]),maxX:Math.max(a.maxX,p[0]),minZ:Math.min(a.minZ,p[1]),maxZ:Math.max(a.maxZ,p[1])}),{minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity});
  const scaleBase=Math.max(18,bounds.maxX-bounds.minX,bounds.maxZ-bounds.minZ);
  const centerX=(bounds.minX+bounds.maxX)/2,centerZ=(bounds.minZ+bounds.maxZ)/2;
  const project=(x,z,h=0)=>{
    const x0=(x-centerX)/scaleBase,z0=(z-centerZ)/scaleBase;
    const a=x0*Math.cos(angle)-z0*Math.sin(angle),b=x0*Math.sin(angle)+z0*Math.cos(angle);
    return[canvas.width/2+a*canvas.width*.72*zoom,canvas.height*.53+b*canvas.height*.29*zoom-h];
  };
  const polygon=(points,h,fill,stroke)=>{
    ctx.beginPath();points.forEach(([x,z],i)=>{const p=project(x,z,h);if(!i)ctx.moveTo(...p);else ctx.lineTo(...p)});ctx.closePath();
    if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke()}
  };
  const draw=()=>{
    if(destroyed)return;
    const dpr=Math.min(2,window.devicePixelRatio||1),w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const sky=ctx.createLinearGradient(0,0,0,canvas.height);sky.addColorStop(0,'#123345');sky.addColorStop(1,'#07141b');ctx.fillStyle=sky;ctx.fillRect(0,0,canvas.width,canvas.height);
    const p1=project(-75,-75,-6),p2=project(75,75,-6);
    ctx.save();ctx.strokeStyle='#285163';ctx.lineWidth=3;for(let k=-6;k<=6;k++){const a=project(k*15,-75,-6),b=project(k*15,75,-6);ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();}ctx.restore();
    // The vertical sides derive from a matched OSM footprint when available.
    const levelH=12+Math.min(8,geometry?.levels||1)*3;
    for(let i=0;i<floor.length;i++){
      const a=floor[i],b=floor[(i+1)%floor.length];const side=[a,b,b,a];
      const t1=project(...a,levelH),t2=project(...b,levelH),g1=project(...a,0),g2=project(...b,0);
      ctx.beginPath();ctx.moveTo(...t1);ctx.lineTo(...t2);ctx.lineTo(...g2);ctx.lineTo(...g1);ctx.closePath();
      ctx.fillStyle=i%2?'#345a63':'#426b71';ctx.globalAlpha=.87;ctx.fill();ctx.globalAlpha=1;ctx.strokeStyle='#a9d2c8';ctx.lineWidth=1;ctx.stroke();
    }
    polygon(floor,0,'#b7a895','#f2daba');
    // Fictional floor props inside the mapped/schematic building shell.
    const furn=[[-6,-3],[6,3],[-6,4],[7,-5]];
    for(const [x,z] of furn){
      const [px,py]=project(x,z,1);ctx.fillStyle='#725345';ctx.beginPath();ctx.ellipse(px,py,16*zoom,8*zoom,0,0,2*Math.PI);ctx.fill();
      ctx.strokeStyle='#d5ae79';ctx.stroke();
    }
    const [bx,by]=project(-2,-8,2);ctx.fillStyle='#d29a4a';ctx.fillRect(bx-28*zoom,by-8*zoom,56*zoom,16*zoom);
    for(const [i,p] of spots.entries()){
      const phase=paused?0:Math.sin(clock*.015+i*4)*1.8;
      const [x,y]=project(p.x+phase,p.z,3);
      ctx.fillStyle='#07151c';ctx.beginPath();ctx.ellipse(x,y+8*zoom,8*zoom,4*zoom,0,0,2*Math.PI);ctx.fill();
      ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(x,y,7*zoom,0,2*Math.PI);ctx.fill();
      if(p.id===selectedId){ctx.strokeStyle='#fff8a4';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,11*zoom,0,2*Math.PI);ctx.stroke();}
    }
    polygon(floor,levelH,'#71a7a01d','#c2e8e2');
    ctx.font=Math.round(13*dpr)+'px system-ui';ctx.fillStyle='#dceee8';
    ctx.fillText(venue?.name||'Illustrative venue',14*dpr,24*dpr);
    ctx.font=Math.round(10*dpr)+'px system-ui';ctx.fillStyle='#a6d0c8';
    ctx.fillText(geometry?.source==='illustrative'?'Schematic exterior · fictional interior':'OSM footprint · fictional interior',14*dpr,42*dpr);
    if(!paused)clock++;frame=requestAnimationFrame(draw);
  };
  const click=event=>{
    const r=canvas.getBoundingClientRect(),x=(event.clientX-r.left)*canvas.width/r.width,y=(event.clientY-r.top)*canvas.height/r.height;
    const closest=spots.map((p,i)=>{const phase=paused?0:Math.sin(clock*.015+i*4)*1.8,pt=project(p.x+phase,p.z,3);return {...p,d:Math.hypot(pt[0]-x,pt[1]-y)}}).sort((a,b)=>a.d-b.d)[0];
    if(closest&&closest.d<24*Math.min(2,window.devicePixelRatio||1)){selectedId=closest.id;onPatronSelect(selectedId);if(paused)draw();}
  };
  canvas.addEventListener('click',click);
  draw();
  return{select(id){selectedId=id;if(paused)draw();},rotate(delta){angle+=delta;if(paused)draw();},setPaused(value){const wasPaused=paused;paused=Boolean(value);if(wasPaused&&!paused)draw();},destroy(){destroyed=true;cancelAnimationFrame(frame);canvas.removeEventListener('click',click);}};
}
