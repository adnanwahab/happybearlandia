import {test,expect} from 'bun:test';
import {validateProject} from '../world/what-if/catalog.js';
import {compareNeighborhood} from '../world/what-if/model.js';
const context={id:'living:pin-fixture',origin:{lat:40.7,lng:-73.9},provenance:{geometrySource:'synthetic fixture'},bounds:{minX:-100,maxX:100,minZ:-80,maxZ:80},districts:[{id:'local',label:'Synthetic district',x:0,z:0}],buildings:[]};
const project={kind:'park',x:0,z:0};
test('all supported additions accept exact edges and reject outside points deterministically',()=>{
 for(const kind of ['park','grocery','housing','transit'])for(const [x,z] of [[-100,-80],[100,80],[0,0]])expect(validateProject({kind,x,z},context)).toEqual({kind,x,z});
 for(const [x,z] of [[-100.001,0],[100.001,0],[0,-80.001],[0,80.001],[NaN,0],[0,Infinity]])for(let i=0;i<2;i++)expect(()=>validateProject({...project,x,z},context)).toThrow();
});
test('missing, reversed and degenerate loaded geometry cannot create a scenario',()=>{
 for(const bounds of [undefined,{minX:1,maxX:0,minZ:0,maxZ:1},{minX:0,maxX:0,minZ:0,maxZ:1},{minX:0,maxX:1,minZ:0,maxZ:Infinity}])expect(()=>validateProject(project,{...context,bounds})).toThrow('geometry');
});
test('free-form policies and extra knobs reject before simulation',async()=>{
 for(const candidate of [{...project,kind:'lower taxes'},{...project,rentReduction:.9},{...project,policy:'anything'}]){
 expect(()=>validateProject(candidate,context)).toThrow();
 await expect(compareNeighborhood({context,project:candidate})).rejects.toThrow();
 }
});
test('completed manifest retains map identity, origin, geometry and provenance and replays after JSON round-trip',async()=>{
 const original=structuredClone(context);
 const a=await compareNeighborhood({context,project,config:{population:8,seed:42}});
 expect(a.manifest.context).toEqual(original);expect(a.manifest.project).toEqual(project);
 const replay=await compareNeighborhood(JSON.parse(JSON.stringify(a.manifest)));
 expect(replay).toEqual(a);expect(context).toEqual(original);
 context.origin.lat=0;expect(a.manifest.context.origin.lat).toBe(40.7);context.origin.lat=40.7;
},30000);
