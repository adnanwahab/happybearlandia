import * as THREE from 'three';

// Interior geometry must be explicitly supplied by the host. A footprint or
// bounding box is not evidence of floors, inhabitants, or a room layout.
export class BuildingCutaway {
  constructor(scene) { this.scene=scene;this.building=null;this.enabled=false;this.progress=0;this.resources=[]; }
  supported(building=this.building) {
    return !!(building?.id!=null && building.kind!=='park' && building.mesh?.parent && !Array.isArray(building.mesh.material) && building.mesh?.geometry?.attributes?.position && building.detailGeometry?.isObject3D && building.detailGeometry!==building.mesh);
  }
  select(building) {
    if(this.building===building)return;
    this.clear();this.building=building;this.enabled=false;
  }
  setEnabled(value) {
    this.enabled=Boolean(value)&&this.supported();
    return this.enabled;
  }
  prepare() {
    const mesh=this.building.mesh;
    const source=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
    source.computeBoundingBox();
    const {min,max}=source.boundingBox, positions=source.attributes.position;
    const roof=[],shell=[],height=max.y-min.y;
    // Split only existing triangles. No caps, rooms or floor plates are inferred.
    for(let i=0;i<positions.count;i+=3){
      const target=[0,1,2].every(j=>positions.getY(i+j)>=max.y-height*.15)?roof:shell;
      target.push(i,i+1,i+2);
    }
    if(!roof.length){source.dispose();this.enabled=false;return;}
    const shellGeometry=source.clone();shellGeometry.setIndex(shell);
    const roofGeometry=source;roofGeometry.setIndex(roof);
    const materials=(Array.isArray(mesh.material)?mesh.material:[mesh.material]).map(m=>m.clone());
    for(const material of materials){material.transparent=true;material.depthWrite=false;}
    this.original={mesh,geometry:mesh.geometry,detailVisible:this.building.detailGeometry.visible};
    mesh.geometry=shellGeometry;
    this.roof=new THREE.Mesh(roofGeometry,Array.isArray(mesh.material)?materials:materials[0]);
    this.roof.matrixAutoUpdate=false;this.roof.matrix.copy(mesh.matrix);this.roof.castShadow=mesh.castShadow;this.roof.receiveShadow=mesh.receiveShadow;
    mesh.parent.add(this.roof);
    this.resources=[shellGeometry,roofGeometry,...materials];
  }
  update(_now,dt=1/60,reducedMotion=false) {
    if(!this.building)return;
    if(this.enabled&&!this.supported())this.enabled=false;
    if(this.enabled&&!this.original)this.prepare();
    const target=this.enabled?1:0;
    this.progress=reducedMotion?target:THREE.MathUtils.clamp(this.progress+(target?1:-1)*Math.min(.1,Math.max(0,dt))/.45,0,1);
    if(this.original){
      const mesh=this.original.mesh;
      this.roof.matrix.copy(mesh.matrix);this.roof.visible=mesh.visible&&this.progress<1;
      this.roof.castShadow=mesh.castShadow&&this.progress<.5;
      for(const material of Array.isArray(this.roof.material)?this.roof.material:[this.roof.material])material.opacity=1-this.progress;
      this.building.detailGeometry.visible=this.progress>0;
      if(!this.progress&&!this.enabled)this.restore();
    }
  }
  get status(){return {id:this.building?.id??null,supported:this.supported(),enabled:this.enabled,progress:this.progress};}
  restore(){
    if(this.original){this.original.mesh.geometry=this.original.geometry;this.building.detailGeometry.visible=this.original.detailVisible;this.roof.removeFromParent();}
    for(const resource of this.resources)resource.dispose();
    this.resources=[];this.original=null;this.roof=null;this.progress=0;
  }
  clear(){this.restore();this.enabled=false;}
  dispose(){this.clear();this.building=null;}
}
