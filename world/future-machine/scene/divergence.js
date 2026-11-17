import {compareHistory,firstDivergence} from '../diff/index.js';
import {constructionGhosts} from './construction-ghosts.js';
import {createSpatialMapping} from './mapping.js';
/** Resolve the first physical change to its exact recorded completion receipt. */
export function divergenceReceipt(history) {
  if(!history)return null;
  const stop=firstDivergence(history,compareHistory(history));if(!stop)return null;
  const rows=constructionGhosts(history,stop.month-1,createSpatialMapping());
  return Object.values(rows).flat().find(r=>r.id===stop.entity.id&&r.eventMonth===stop.month)??null;
}
export function createDivergenceGate(history){
  const receipt=divergenceReceipt(history),seen=new Set();
  return {receipt,take(frame){
    if(!receipt||frame?.month!==receipt.eventMonth||seen.has(receipt.eventId))return null;
    const event=frame[receipt.arm]?.events?.find(e=>e.id===receipt.eventId);
    if(!event||event.simulationTime!==frame.month||event.payload?.projectId!==receipt.projectId)return null;
    seen.add(receipt.eventId);return receipt;
  }};
}
/** Monotonic time controls only the appearance of an already validated event. */
export function createDivergenceBurst(THREE,scenes,row){
  const groups=scenes.map(scene=>{
    const group=new THREE.Group();group.position.set(row.x,.3,row.z);scene.add(group);
    const ring=new THREE.Mesh(new THREE.RingGeometry(.94,1,64),new THREE.MeshBasicMaterial({color:0x83f6d1,transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;group.add(ring);
    const geometry=new THREE.BoxGeometry(.7,.7,.7),material=new THREE.MeshBasicMaterial({color:0xffd590,transparent:true,opacity:1});
    for(let i=0;i<24;i++){const spark=new THREE.Mesh(geometry,material);spark.userData.angle=i*Math.PI*2/24;group.add(spark);}return group;
  });
  let start=null;
  return {tick(now){start??=now;const t=Math.min(1,(now-start)/3000);for(const group of groups){const ring=group.children[0];ring.scale.setScalar(1+100*t);ring.material.opacity=(1-t)*.8;for(const spark of group.children.slice(1)){const a=spark.userData.angle,r=2+18*t;spark.position.set(Math.cos(a)*r,Math.max(0,Math.sin(Math.PI*t)*14),Math.sin(a)*r);spark.material.opacity=1-t;}}return t<1;},dispose(){for(const group of groups){group.removeFromParent();const geometries=new Set(),materials=new Set();group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}}};
}
