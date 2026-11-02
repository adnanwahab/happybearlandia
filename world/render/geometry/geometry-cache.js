import * as THREE from 'three';
import {generateBuildingGeometry} from './building-generator.js';
export function toBufferGeometry(data) {
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(data.positions,3));geometry.setAttribute('normal',new THREE.BufferAttribute(data.normals,3));geometry.setAttribute('uv',new THREE.BufferAttribute(data.uvs,2));geometry.userData={...data.metadata};
 for(const group of data.metadata.groups||[])geometry.addGroup(group.start,group.count,group.materialIndex);
 geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
export class GeometryCache {
 constructor({maxBytes=32*1024*1024,worker=true}={}) {this.maxBytes=maxBytes;this.bytes=0;this.cache=new Map();this.pending=new Map();this.nextId=0;this.worker=null;
  if(worker&&typeof Worker!=='undefined')try{this.worker=new Worker(new URL('./workers/geometry.worker.js',import.meta.url),{type:'module'});this.worker.onmessage=({data})=>{const job=this.pending.get(data.id);if(!job)return;this.pending.delete(data.id);data.error?job.reject(new Error(data.error)):job.resolve(data.result);};this.worker.onerror=error=>{for(const job of this.pending.values())job.reject(new Error(error.message||'Geometry worker failed'));this.pending.clear();this.worker.terminate();this.worker=null;};}catch{}
 }
 async building(input,quality='BALANCED') {
  const key=JSON.stringify([input,quality]);if(this.cache.has(key)){const data=this.cache.get(key);this.cache.delete(key);this.cache.set(key,data);return data;}
  let data;if(this.worker){data=await new Promise((resolve,reject)=>{const id=this.nextId++;this.pending.set(id,{resolve,reject});this.worker.postMessage({id,type:'building',input,quality});});}else{await new Promise(resolve=>setTimeout(resolve,0));data=generateBuildingGeometry(input,quality);}
  while(this.bytes+data.metadata.bytes>this.maxBytes&&this.cache.size){const oldest=this.cache.keys().next().value;this.bytes-=this.cache.get(oldest).metadata.bytes;this.cache.delete(oldest);}
  if(data.metadata.bytes<=this.maxBytes){this.cache.set(key,data);this.bytes+=data.metadata.bytes;}return data;
 }
 dispose(){this.worker?.terminate();for(const job of this.pending.values())job.reject(new Error('Geometry cache disposed'));this.pending.clear();this.cache.clear();this.bytes=0;}
}
