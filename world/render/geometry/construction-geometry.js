// Instance descriptions share slab, column and core box geometries on the GPU.
export function generateConstructionGeometry(state,quality='BALANCED') {
 const floors=Math.max(1,Math.min(200,Math.floor(state.floors??(state.height||40)/3.4))),floorHeight=state.floorHeight??3.4,width=state.width??20,depth=state.depth??20;
 if(![floors,floorHeight,width,depth].every(v=>Number.isFinite(v)&&v>0))throw new RangeError('Invalid construction dimensions');
 const built=Math.min(floors,Math.max(0,Math.floor(state.floorsBuilt??floors*Math.max(0,Math.min(1,state.progress||0))))),installed=Math.max(0,Math.min(built,Math.floor(state.facadeFloors??(state.phase==='facade'?built*.7:0))));
 const slabs=Array.from({length:built+1},(_,i)=>({position:[0,i*floorHeight,0],scale:[width,.25,depth]})),columns=[];
 for(const x of [-width/2,width/2])for(const z of [-depth/2,depth/2])columns.push({position:[x,built*floorHeight/2,z],scale:[.6,Math.max(.1,built*floorHeight),.6]});
 const core={position:[0,Math.min(floors,built+2)*floorHeight/2,0],scale:[Math.max(2,width*.16),Math.min(floors,built+2)*floorHeight,Math.max(2,depth*.16)]};
 return {slabs,columns,core,facade:installed?{position:[0,installed*floorHeight/2,0],scale:[width,installed*floorHeight,depth]}:null,metadata:{category:'construction',lod:quality==='LOW'?2:0,triangles:(slabs.length+columns.length+1+(installed?1:0))*12,priority:.9,floorsBuilt:built}};
}
