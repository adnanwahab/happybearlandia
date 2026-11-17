import {test,expect} from 'bun:test';
import {createHash} from 'node:crypto';
import {buildPedestrianNetwork,pedestrianRoute} from '../world/population/pedestrian-routes.js';
// Golden captured from the exhaustive nearest/target-limited heap implementation
// before the optimization. Includes equal-cost grids, diagonal intersections,
// off-network access, zero-length trips and seeded jaywalking.
test('indexed lookup and reused source trees preserve 502 previous routes byte for byte',()=>{
 const roads=[];for(let i=0;i<12;i++)roads.push({pts:[[i*35,-50],[i*35,450]]},{pts:[[-50,i*35],[450,i*35]]});roads.push({pts:[[-50,-50],[450,450]]});
 const network=buildPedestrianNetwork(roads);let seed=42;const r=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return(seed%60000)/100-100};const queries=[];
 for(let i=0;i<500;i++)queries.push([[r(),r()],[r(),r()],{jaywalk:i%50===0}]);queries.push([[0,0],[0,0],{}],[[17.5,17.5],[52.5,52.5],{}]);
 const rows=queries.map(args=>pedestrianRoute(network,...args));expect(createHash('sha256').update(JSON.stringify(rows)).digest('hex')).toBe('83f0a15e3d2212e49ae7400b81081f3072b7ae047b5d0eb2155185a45ef0879e');
 // Revisit after eviction pressure; caches may affect work, never answers.
 for(let i=0;i<4500;i++)pedestrianRoute(network,[-100-i*.01,-100],[400,400]);
 expect(queries.map(args=>pedestrianRoute(network,...args))).toEqual(rows);
});
test('resumed frontier preserves previous heap tie behavior across destinations from repeated origins',()=>{
 const roads=[];for(let i=0;i<12;i++)roads.push({pts:[[i*35,-50],[i*35,450]]},{pts:[[-50,i*35],[450,i*35]]});
 const network=buildPedestrianNetwork(roads),rows=[];
 for(const from of [[0,0],[17.5,17.5],[-18,90],[124,100]])for(let j=0;j<60;j++)rows.push(pedestrianRoute(network,from,[j*7-40,j*13%450-40],{jaywalk:j%9===0}));
 expect(createHash('sha256').update(JSON.stringify(rows)).digest('hex')).toBe('b23a53133511bc21974d51b8b3192e746ae2ad1eefc71e7077b6bb7542f6e6dd');
});
