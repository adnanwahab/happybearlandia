import * as THREE from 'three';
// Only the selected building gets real floor geometry. Interior activity is a
// visual approximation unless occupancy is explicitly supplied by the host.
export class BuildingCutaway {
  constructor(scene) {this.scene=scene;this.group=new THREE.Group();this.group.visible=false;scene.add(this.group);this.resources=[];this.building=null;this.enabled=false;}
  select(building, occupancy=.7) {
    if(this.building===building)return;
    this.clear();this.building=building;if(!building)return;
    const box=building.mesh.geometry.boundingBox,size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
    this.group.position.set(center.x,0,center.z);
    const floors=Math.min(80,Math.max(1,Math.floor(size.y/3.4))),floorHeight=size.y/floors;
    const geometry=new THREE.BoxGeometry(1,1,1),material=new THREE.MeshStandardMaterial({color:0xb9ac91,roughness:.85});this.resources.push(geometry,material);
    const slabs=new THREE.InstancedMesh(geometry,material,floors),d=new THREE.Object3D();
    for(let f=0;f<floors;f++){d.position.set(0,f*floorHeight+.15,0);d.scale.set(size.x,.22,size.z);d.updateMatrix();slabs.setMatrixAt(f,d.matrix);}this.group.add(slabs);
    const back=new THREE.Mesh(geometry,material);back.position.set(0,size.y/2,-size.z/2);back.scale.set(size.x,size.y,.25);this.group.add(back);
    const peopleCount=Math.min(500,Math.floor(floors*5*THREE.MathUtils.clamp(occupancy,0,1)));
    const peopleMaterial=new THREE.MeshStandardMaterial({color:0x516e88});this.resources.push(peopleMaterial);
    const people=new THREE.InstancedMesh(geometry,peopleMaterial,peopleCount);
    for(let i=0;i<peopleCount;i++){d.position.set(Math.sin(i*17)*size.x*.4,Math.floor(i/5)%floors*floorHeight+1,Math.cos(i*7)*size.z*.3);d.scale.set(.45,1.5,.45);d.updateMatrix();people.setMatrixAt(i,d.matrix);}this.group.add(people);
    const elevatorMaterial=new THREE.MeshStandardMaterial({color:0xc5b774,emissive:0x483811});this.resources.push(elevatorMaterial);this.elevator=new THREE.Mesh(geometry,elevatorMaterial);this.elevator.scale.set(1.6,2,1.6);this.elevator.position.x=size.x*.4;this.group.add(this.elevator);this.height=size.y;
    this.group.userData={floors,occupancy,illustrative:true};
  }
  update(now){this.group.visible=this.enabled&&!!this.building;if(this.group.visible){this.building.mesh.visible=false;this.group.scale.y=this.building.mesh.scale.y;if(this.elevator)this.elevator.position.y=1+(Math.sin(now*.0002)*.5+.5)*Math.max(0,this.height-3);}}
  clear(){this.group.clear();for(const resource of this.resources)resource.dispose();this.resources=[];this.elevator=null;}
  dispose(){this.clear();this.scene.remove(this.group);}
}
