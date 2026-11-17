/** A bounded visual raster of supplied World geometry; never a model authority. */
export const TILE_VIEW_VERSION = 'world-tile-view.v1';
const finitePoint = p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]);
export function pointInPolygon(x,z,points){
 let inside=false;
 for(let i=0,j=points.length-1;i<points.length;j=i++){
  const a=points[i],b=points[j];
  if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }
 return inside;
}
export function distanceToSegment(x,z,a,b){
 const dx=b[0]-a[0],dz=b[1]-a[1],d=dx*dx+dz*dz;
 const t=d?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/d)):0;
 return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);
}
export function createWorldTiles(frame,{cellSize=8,maxAxis=128}={}){
 if(!Number.isFinite(cellSize)||cellSize<=0||!Number.isInteger(maxAxis)||maxAxis<8||maxAxis>256)throw Error('Invalid tile bounds');
 const buildings=(frame?.buildings??[]).filter(b=>b.id!=null&&Array.isArray(b.poly)&&b.poly.length>=3&&b.poly.every(finitePoint));
 const roads=(frame?.roads??[]).filter(r=>Array.isArray(r.pts)&&r.pts.length>=2&&r.pts.every(finitePoint));
 let minX=Infinity,minZ=Infinity,maxX=-Infinity,maxZ=-Infinity;
 const extend=p=>{minX=Math.min(minX,p[0]);maxX=Math.max(maxX,p[0]);minZ=Math.min(minZ,p[1]);maxZ=Math.max(maxZ,p[1]);};
 for(const b of buildings)for(const p of b.poly)extend(p);
 for(const r of roads)for(const p of r.pts)extend(p);
 if(!Number.isFinite(minX))return null;
 const size=Math.max(cellSize,(maxX-minX)/(maxAxis-4),(maxZ-minZ)/(maxAxis-4));
 minX-=size*2;minZ-=size*2;maxX+=size*2;maxZ+=size*2;
 const columns=Math.min(maxAxis,Math.max(1,Math.ceil((maxX-minX)/size))),rows=Math.min(maxAxis,Math.max(1,Math.ceil((maxZ-minZ)/size)));
 const cells=Array.from({length:columns*rows},()=>({kind:'ground',buildings:[],roads:[]}));
 const indexAt=(x,z)=>{const col=Math.floor((x-minX)/size),row=Math.floor((z-minZ)/size);return col>=0&&row>=0&&col<columns&&row<rows?row*columns+col:-1;};
 const visit=(loX,loZ,hiX,hiZ,fn)=>{for(let row=Math.max(0,Math.floor((loZ-minZ)/size));row<=Math.min(rows-1,Math.floor((hiZ-minZ)/size));row++)for(let col=Math.max(0,Math.floor((loX-minX)/size));col<=Math.min(columns-1,Math.floor((hiX-minX)/size));col++)fn(cells[row*columns+col],minX+(col+.5)*size,minZ+(row+.5)*size);};
 for(const road of roads){const width=Number.isFinite(road.width)&&road.width>0?Math.min(60,road.width):8;
  for(let i=1;i<road.pts.length;i++){const a=road.pts[i-1],b=road.pts[i],strip=width/2+2;
   visit(Math.min(a[0],b[0])-strip,Math.min(a[1],b[1])-strip,Math.max(a[0],b[0])+strip,Math.max(a[1],b[1])+strip,(cell,x,z)=>{
    const distance=distanceToSegment(x,z,a,b);if(distance>strip+size*.35)return;
    if(distance<=width/2){cell.kind='road';}else if(cell.kind!=='road')cell.kind='sidewalk';
    const id=String(road.id??road.name??'mapped-road');if(!cell.roads.includes(id))cell.roads.push(id);
   });
  }
 }
 for(const building of buildings){const poly=building.poly;let loX=Infinity,loZ=Infinity,hiX=-Infinity,hiZ=-Infinity;for(const p of poly){loX=Math.min(loX,p[0]);loZ=Math.min(loZ,p[1]);hiX=Math.max(hiX,p[0]);hiZ=Math.max(hiZ,p[1]);}
  const id=String(building.id);let found=false;
  visit(loX,loZ,hiX,hiZ,(cell,x,z)=>{if(!pointInPolygon(x,z,poly))return;cell.buildings.push(id);cell.kind=building.kind==='park'?'park':'lot';found=true;});
  // Sub-cell lots still remain discoverable by their actual footprint centroid.
  if(!found){const center=poly.reduce((a,p)=>[a[0]+p[0]/poly.length,a[1]+p[1]/poly.length],[0,0]),index=indexAt(...center);if(index>=0){cells[index].buildings.push(id);cells[index].kind=building.kind==='park'?'park':'lot';}}
 }
 return{version:TILE_VIEW_VERSION,columns,rows,cellSize:size,minX,minZ,cells,indexAt,buildings:new Map(buildings.map(b=>[String(b.id),b])),sourceGeometryKey:frame.geometryKey??null};
}
export function indexTilePeople(tiles,people=[]){
 const byCell=new Map();let missing=0;
 for(const person of Array.isArray(people)?people:[]){if(person?.id==null||!Number.isFinite(person.x)||!Number.isFinite(person.z)){missing++;continue;}const index=tiles.indexAt(person.x,person.z);if(index<0){missing++;continue;}if(!byCell.has(index))byCell.set(index,[]);byCell.get(index).push(person);}
 return{byCell,missing};
}
