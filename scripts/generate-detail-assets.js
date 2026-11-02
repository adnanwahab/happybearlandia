// bun scripts/generate-detail-assets.js — tiny authored geometry for importer QA.
import { MeshBuilder } from '../world/render/geometry/mesh-data.js';
const builder=new MeshBuilder();
builder.box(0,.45,0,1.8,.12,.48);builder.box(0,.85,-.21,1.8,.65,.08);
for(const x of [-.65,.65]){builder.box(x,.2,0,.08,.4,.42);builder.box(x,.72,0,.07,.07,.45);}
const data=builder.finish(),arrays=[data.positions,data.normals,data.uvs],offsets=[];let bytes=0;
for(const array of arrays){offsets.push(bytes);bytes+=array.byteLength;}
const binary=new Uint8Array(bytes);arrays.forEach((array,i)=>binary.set(new Uint8Array(array.buffer,array.byteOffset,array.byteLength),offsets[i]));
const mins=[Infinity,Infinity,Infinity],maxs=[-Infinity,-Infinity,-Infinity];for(let i=0;i<data.positions.length;i++){mins[i%3]=Math.min(mins[i%3],data.positions[i]);maxs[i%3]=Math.max(maxs[i%3],data.positions[i]);}
const json={asset:{version:'2.0',generator:'HappyBearLandia procedural bench preview'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0,name:'bench-preview'}],meshes:[{primitives:[{attributes:{POSITION:0,NORMAL:1,TEXCOORD_0:2},material:0}]}],materials:[{name:'wood-and-frame-preview',pbrMetallicRoughness:{baseColorFactor:[.24,.16,.085,1],metallicFactor:0,roughnessFactor:.85}}],buffers:[{byteLength:bytes}],bufferViews:arrays.map((a,i)=>({buffer:0,byteOffset:offsets[i],byteLength:a.byteLength,target:34962})),accessors:arrays.map((a,i)=>({bufferView:i,componentType:5126,count:a.length/(i===2?2:3),type:i===2?'VEC2':'VEC3',...(i===0?{min:mins,max:maxs}:{})}))};
let text=JSON.stringify(json);while(text.length%4)text+=' ';
const encoded=new TextEncoder().encode(text),output=new ArrayBuffer(12+8+encoded.length+8+binary.length),view=new DataView(output);
view.setUint32(0,0x46546c67,true);view.setUint32(4,2,true);view.setUint32(8,output.byteLength,true);view.setUint32(12,encoded.length,true);view.setUint32(16,0x4e4f534a,true);new Uint8Array(output,20,encoded.length).set(encoded);const offset=20+encoded.length;view.setUint32(offset,binary.length,true);view.setUint32(offset+4,0x004e4942,true);new Uint8Array(output,offset+8).set(binary);
await Bun.write(new URL('../world/render/assets/models/bench-preview.glb',import.meta.url),output);console.log(`Wrote bench-preview.glb (${output.byteLength} bytes, ${data.metadata.triangles} triangles)`);
