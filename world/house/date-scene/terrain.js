/** Date-local elevation only. Invalid/unavailable DEMs never become fake hills. */
export function terrainGrid(value){
 const rows=value?.rows,cols=value?.cols??value?.columns,spanM=value?.spanM;
 if(!Number.isInteger(rows)||!Number.isInteger(cols)||rows<2||cols<2||rows>129||cols>129||!Number.isFinite(spanM)||spanM<=0||spanM>2000)return null;
 const heights=Array.isArray(value.heights?.[0])?value.heights.flat():value.heights;
 if(!heights||heights.length!==rows*cols||!Array.from(heights).every(h=>Number.isFinite(h)&&Math.abs(h)<15000))return null;
 return {...value,rows,cols,spanM,heights};
}
export function sampleTerrainHeight(value,x,z){const grid=terrainGrid(value);if(!grid||!Number.isFinite(x)||!Number.isFinite(z))return 0;return sampleGridHeight(grid,x,z);}
export function sampleGridHeight(grid,x,z){
 const col=Math.max(0,Math.min(grid.cols-1,(x/grid.spanM+.5)*(grid.cols-1))),row=Math.max(0,Math.min(grid.rows-1,(z/grid.spanM+.5)*(grid.rows-1))),i=Math.min(grid.cols-2,Math.floor(col)),j=Math.min(grid.rows-2,Math.floor(row)),u=col-i,v=row-j;
 const a=grid.heights[j*grid.cols+i],b=grid.heights[j*grid.cols+i+1],c=grid.heights[(j+1)*grid.cols+i],d=grid.heights[(j+1)*grid.cols+i+1];
 return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
}
export function buildTerrainSurface(THREE,input){const grid=terrainGrid(input);if(!grid)return null;const vertices=[],colors=[],indices=[],grass=new THREE.Color('#71835b'),stone=new THREE.Color('#a49d8b');
 for(let r=0;r<grid.rows;r++)for(let c=0;c<grid.cols;c++){
 const x=(c/(grid.cols-1)-.5)*grid.spanM,z=(r/(grid.rows-1)-.5)*grid.spanM,h=grid.heights[r*grid.cols+c];vertices.push(x,h,z);
 const step=grid.spanM/Math.max(grid.rows-1,grid.cols-1),slope=Math.hypot(sampleGridHeight(grid,x+step,z)-sampleGridHeight(grid,x-step,z),sampleGridHeight(grid,x,z+step)-sampleGridHeight(grid,x,z-step))/(2*step),color=grass.clone().lerp(stone,Math.max(0,Math.min(1,(slope-.25)*1.7)));colors.push(color.r,color.g,color.b);
 if(r<grid.rows-1&&c<grid.cols-1){const a=r*grid.cols+c,b=a+1,d=a+grid.cols+1,e=a+grid.cols;indices.push(a,e,b,b,e,d);}
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();return {geometry,grid,sample:(x,z)=>sampleGridHeight(grid,x,z)};
}
