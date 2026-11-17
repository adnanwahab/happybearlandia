export function createEvidencePathLayer({THREE, scene}) {
  let group = null, disposed = 0;
  function clear() {
    if (!group) return;
    scene.remove(group);
    group.traverse(object => { if(object.geometry){object.geometry.dispose();disposed++;} if(object.material){object.material.dispose();disposed++;} });
    group = null;
  }
  return {
    show(report) {
      clear(); group = new THREE.Group(); group.name = 'Recorded evidence path';
      for (const segment of report.segments) {
        if(segment.kind !== 'segment') continue;
        const points=[segment.start,segment.end].map(p=>new THREE.Vector3(p.x,.3,p.z));
        const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineDashedMaterial({color:0xffd166,dashSize:1.2,gapSize:.8,depthTest:true}));
        line.computeLineDistances();line.userData={edgeId:segment.id,eventIds:[...segment.eventIds]};group.add(line);
        for (const p of points) {
          const marker=new THREE.Mesh(new THREE.RingGeometry(.7,1.1,16),new THREE.MeshBasicMaterial({color:0xffd166,side:THREE.DoubleSide}));
          marker.rotation.x=-Math.PI/2;marker.position.copy(p);marker.userData={...line.userData};group.add(marker);
        }
      }
      scene.add(group);
    },
    clear,
    stats:()=>({objects:group?.children.length??0,disposedResources:disposed}),
    destroy:clear,
  };
}
