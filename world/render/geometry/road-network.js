import {generateRoadGeometry} from './road-generator.js';
import {generateIntersectionGeometry} from './intersection-generator.js';
// Split ribbons at junction boundaries. A single polygon fills each junction;
// asphalt rectangles never overlap across the intersection itself.
export function generateRoadNetwork(roads,{width=9,sidewalkWidth=2}={}) {
 const segments=[];for(const road of roads)for(let i=1;i<road.pts.length;i++){const a=road.pts[i-1],b=road.pts[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length>.1)segments.push({a,b,length,cuts:[]});}
 const junctions=new Map(),cells=new Map(),pairs=new Set();
 segments.forEach((s,i)=>{for(let x=Math.floor(Math.min(s.a[0],s.b[0])/128);x<=Math.floor(Math.max(s.a[0],s.b[0])/128);x++)for(let z=Math.floor(Math.min(s.a[1],s.b[1])/128);z<=Math.floor(Math.max(s.a[1],s.b[1])/128);z++){const key=`${x},${z}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(i);}});
 for(const indices of cells.values())for(let i=0;i<indices.length;i++)for(let j=i+1;j<indices.length;j++){const ai=Math.min(indices[i],indices[j]),bi=Math.max(indices[i],indices[j]),key=`${ai}:${bi}`;if(pairs.has(key))continue;pairs.add(key);const a=segments[ai],b=segments[bi],u=[a.b[0]-a.a[0],a.b[1]-a.a[1]],v=[b.b[0]-b.a[0],b.b[1]-b.a[1]],den=u[0]*v[1]-u[1]*v[0];
  // This initial junction kit handles approximately orthogonal streets. Other
  // angles retain their continuous ribbons until polygon union is available.
  if(Math.abs(den)/(a.length*b.length)<.98||Math.max(Math.abs(u[0]),Math.abs(u[1]))/a.length<.999||Math.max(Math.abs(v[0]),Math.abs(v[1]))/b.length<.999)continue;
  const d=[b.a[0]-a.a[0],b.a[1]-a.a[1]],t=(d[0]*v[1]-d[1]*v[0])/den,q=(d[0]*u[1]-d[1]*u[0])/den;
  if(t<0||t>1||q<0||q>1)continue;const x=a.a[0]+u[0]*t,z=a.a[1]+u[1]*t,r=width/2+sidewalkWidth;
  a.cuts.push([Math.max(0,t-r/a.length),Math.min(1,t+r/a.length)]);b.cuts.push([Math.max(0,q-r/b.length),Math.min(1,q+r/b.length)]);junctions.set(`${x.toFixed(2)},${z.toFixed(2)}`,{x,z,radius:r});
 }
 const ribbons=[];for(const s of segments){let start=0;const point=t=>[s.a[0]+(s.b[0]-s.a[0])*t,s.a[1]+(s.b[1]-s.a[1])*t];for(const [a,b] of s.cuts.sort((a,b)=>a[0]-b[0])){if(a>start+.001)ribbons.push(generateRoadGeometry({pts:[point(start),point(a)],width,sidewalkWidth}));start=Math.max(start,b);}if(start<.999)ribbons.push(generateRoadGeometry({pts:[point(start),s.b],width,sidewalkWidth}));}
 const data=[...ribbons,...[...junctions.values()].map(j=>generateIntersectionGeometry(j))],surfaces=[{positions:[],normals:[],uvs:[]},{positions:[],normals:[],uvs:[]}];
 for(const item of data)for(const group of item.metadata.groups||[{start:0,count:item.positions.length/3,materialIndex:0}]) {
  const surface=surfaces[group.materialIndex];for(let i=group.start*3;i<(group.start+group.count)*3;i++){surface.positions.push(item.positions[i]);surface.normals.push(item.normals[i]);}for(let i=group.start*2;i<(group.start+group.count)*2;i++)surface.uvs.push(item.uvs[i]);
 }
 const positions=[],normals=[],uvs=[],groups=[];
 for(const [materialIndex,surface] of surfaces.entries()){groups.push({start:positions.length/3,count:surface.positions.length/3,materialIndex});for(const v of surface.positions)positions.push(v);for(const v of surface.normals)normals.push(v);for(const v of surface.uvs)uvs.push(v);}
 return {positions:new Float32Array(positions),normals:new Float32Array(normals),uvs:new Float32Array(uvs),metadata:{category:'roads',lod:1,triangles:positions.length/9,groups,junctions:junctions.size,intersections:[...junctions.values()],bytes:(positions.length+normals.length+uvs.length)*4}};
}
