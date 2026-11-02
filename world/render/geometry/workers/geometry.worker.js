import {generateBuildingGeometry} from '../building-generator.js';
import {generateRoadGeometry} from '../road-generator.js';
import {buildChunkHLOD} from '../lod/hlod-generator.js';
const generators={building:generateBuildingGeometry,road:generateRoadGeometry,hlod:buildChunkHLOD};
self.onmessage=({data})=>{
 const {id,type,input,quality}=data;
 try{if(!generators[type])throw new RangeError('Unknown geometry job');const result=generators[type](input,quality);self.postMessage({id,result},[result.positions.buffer,result.normals.buffer,result.uvs.buffer]);}
 catch(error){self.postMessage({id,error:error.message});}
};
