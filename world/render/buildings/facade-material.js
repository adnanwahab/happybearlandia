import { MeshStandardNodeMaterial, Color } from 'three/webgpu';
import { positionLocal, normalLocal, uniform, mix, vec3, vec4, sin, dot, fract, step, materialColor, cameraPosition, modelWorldMatrixInverse, Fn, If } from 'three/tsl';
export function createFacadeMaterial(color, seed = 0, layout = {}) {
  const night = uniform(0), enabled = uniform(1), interiorEnabled=uniform(1),occupancy=uniform(.7),landscape=uniform(layout.park?1:0);
  const axis = positionLocal.x.mul(normalLocal.z.abs()).add(positionLocal.z.mul(normalLocal.x.abs()));
  const cellX = axis.div(uniform(layout.columnSpacing||3.2)), cellY = positionLocal.y.div(uniform(layout.floorHeight||3.4));
  const u = fract(cellX), v = fract(cellY),halfWidth=uniform((layout.windowWidth||.6)/2),halfHeight=uniform((layout.windowHeight||.6)/2);
  const side = step(.5, normalLocal.y.abs()).oneMinus();
  const window = step(halfWidth.negate().add(.5),u).mul(step(u,halfWidth.add(.5))).mul(step(halfHeight.negate().add(.5),v)).mul(step(v,halfHeight.add(.5))).mul(side).mul(enabled).mul(landscape.oneMinus());
  const random = fract(sin(dot(vec3(cellX.floor(),cellY.floor(),uniform(seed)),vec3(12.9898,78.233,37.719))).mul(43758.5453));
  const lit = step(random,occupancy);
  const glass = mix(vec3(.12,.2,.26),vec3(.36,.45,.49),v);
  // Intersect a view-dependent ray with a virtual room box. This is shader-only:
  // no apartment meshes, room textures or per-window scene objects are created.
  const room=Fn(()=>{
    const result=glass.toVar();
    If(interiorEnabled.greaterThan(.5).and(window.greaterThan(.5)),()=>{
      const view=modelWorldMatrixInverse.mul(vec4(cameraPosition,1)).xyz.sub(positionLocal).normalize();
      const horizontal=view.x.mul(normalLocal.z.abs()).add(view.z.mul(normalLocal.x.abs())).negate();
      const ray=vec3(horizontal,view.y.negate(),dot(view,normalLocal).abs().max(.03).negate());
      const origin=vec3(u.sub(.5).div(halfWidth).clamp(-.999,.999),v.sub(.5).div(halfHeight).clamp(-.999,.999),1);
      const sign=mix(vec3(-1),vec3(1),step(vec3(0),ray));
      const safe=sign.mul(ray.abs().max(.001));
      const times=sign.sub(origin).div(safe),distance=times.x.min(times.y).min(times.z);
      const hit=origin.add(ray.mul(distance));
      const back=step(.98,hit.z.abs()),ceiling=step(.98,hit.y),floor=step(hit.y,-.98);
      const walls=mix(vec3(.22,.2,.17),vec3(.4,.34,.26),back).mul(ceiling.mul(.35).oneMinus()).mul(floor.mul(.4).oneMinus());
      const furniture=step(hit.x.abs(),.48).mul(step(hit.y,-.2)).mul(back);
      const curtain=step(u,random.mul(.3)),blinds=step(.5,fract(v.mul(14).add(random))).mul(step(.75,random));
      result.assign(walls.mul(furniture.mul(.6).oneMinus()).mul(curtain.mul(.5).oneMinus()).mul(blinds.mul(.3).oneMinus()));
    });
    return result;
  })();
  const material = new MeshStandardNodeMaterial({ color: new Color(color), roughness: .78, metalness: .08 });
  const grain=fract(sin(dot(positionLocal.xz.floor().add(positionLocal.y.floor()),vec3(12.9898,78.233,37.719).xy)).mul(43758.5453));
  const mortar=step(.96,fract(positionLocal.y.mul(3.5))).mul(.1);
  const floorBand=step(.95,v).mul(.12);
  const weathering=mix(.86,1,grain).sub(mortar).sub(floorBand);
  const roof=mix(vec3(.095,.105,.10),materialColor,landscape).mul(mix(.94,1,grain));
  const view=modelWorldMatrixInverse.mul(vec4(cameraPosition,1)).xyz.sub(positionLocal).normalize();
  const reflection=dot(view,normalLocal).abs().oneMinus().pow(3).mul(.55).add(.18);
  const reflectedRoom=mix(room,glass.mul(1.3),reflection);
  const wall=materialColor.mul(weathering).mul(mix(vec3(1),reflectedRoom,window));
  material.colorNode = mix(wall,roof,step(.65,normalLocal.y));
  material.roughnessNode=mix(.9,.28,window);material.metalnessNode=mix(.04,.3,window);
  material.emissiveNode = vec3(1,.69,.31).mul(window).mul(lit).mul(night).mul(.5);
  return { material, setNight(value) { night.value = value; }, setEnabled(value) { enabled.value = value ? 1 : 0; },setInteriorEnabled(value){interiorEnabled.value=value?1:0;},setOccupancy(value){occupancy.value=Math.max(0,Math.min(1,value));} };
}
