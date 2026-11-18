import { MeshBasicNodeMaterial, AdditiveBlending, DoubleSide } from 'three/webgpu';
import { uv, float, uniform } from 'three/tsl';
import { intensityColor } from './columns-material.js';
export { intensityColor };
/** Radial additive sprite; horizontal ground-plane discs have real depth testing. */
export function createParticleMaterial() {
 const phase=uniform(0);
 const material=new MeshBasicNodeMaterial({vertexColors:true,transparent:true,depthWrite:false,depthTest:true,blending:AdditiveBlending,side:DoubleSide,forceSinglePass:true,toneMapped:false});
 const radius=uv().sub(.5).length().mul(2);
 material.opacityNode=float(1).sub(radius).max(0).pow(3).mul(phase.sin().mul(.06).add(.94));
 return {material,phase};
}
