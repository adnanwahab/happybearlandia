import { Color, SphereGeometry, Mesh, BackSide, MeshBasicNodeMaterial } from 'three/webgpu';
import { positionLocal, uniform, vec2, vec3, fract, sin, dot, mix, smoothstep } from 'three/tsl';

// One background draw, no cloud textures or volumetric raymarching.
export function createCitySky(scene) {
  const daylight = uniform(1), overcast = uniform(0), tint=uniform(new Color(0xffffff));
  const direction = positionLocal.normalize();
  function noise(p) {
    const cell = p.floor(), f = fract(p), blend = f.mul(f).mul(f.mul(-2).add(3));
    const hash = offset => fract(sin(dot(cell.add(offset), vec2(127.1,311.7))).mul(43758.5453));
    return mix(mix(hash(vec2(0,0)),hash(vec2(1,0)),blend.x),mix(hash(vec2(0,1)),hash(vec2(1,1)),blend.x),blend.y);
  }
  const plane = direction.xz.mul(3).add(direction.y.mul(2));
  const cloudNoise = noise(plane.mul(2)).mul(.58).add(noise(plane.mul(4.1)).mul(.28)).add(noise(plane.mul(8.3)).mul(.14));
  const clouds = smoothstep(.54,.72,cloudNoise).mul(smoothstep(.02,.18,direction.y)).mul(.7);
  const horizon = vec3(.34,.52,.66), zenith = vec3(.009,.065,.21);
  const blue = mix(horizon,zenith,direction.y.max(0).pow(.13));
  const day = mix(blue,vec3(.72,.76,.77),clouds.add(overcast.mul(.55)).clamp());
  const material = new MeshBasicNodeMaterial({side:BackSide,depthWrite:false,fog:false});
  material.colorNode = mix(tint,day,daylight.mul(.55));
  const geometry = new SphereGeometry(4400,24,12), sky = new Mesh(geometry,material);
  sky.frustumCulled=false;sky.renderOrder=-1000;scene.add(sky);
  return {update(camera,light,weather,enabled=true,lighting){tint.value.setHex(lighting?.skyColor??0xffffff);sky.position.copy(camera.position);sky.visible=enabled;daylight.value=.025+.975*light;overcast.value=weather==='rain'?.9:weather==='cloudy'?.6:0;},dispose(){scene.remove(sky);geometry.dispose();material.dispose();}};
}
