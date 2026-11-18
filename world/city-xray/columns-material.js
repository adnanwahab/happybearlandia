import { MeshBasicNodeMaterial, AdditiveBlending, DoubleSide } from 'three/webgpu';
import { uv, float } from 'three/tsl';
/** Linear RGB display ramp. Values are normalized by the frame, never per-view extrema. */
export function intensityColor(t) {
 if (!Number.isFinite(t) || t < 0 || t > 1) throw new RangeError('normalized intensity must be 0..1');
 const stops=[[.12,1,.2],[1,1,.12],[1,.38,.03],[1,.035,.015]];
 if(t===1)return [...stops[3]];
 const n=t*3,i=Math.min(2,Math.floor(n)),f=n-i;
 return stops[i].map((v,k)=>v+(stops[i+1][k]-v)*f);
}
export function createColumnMaterials() {
 const core=new MeshBasicNodeMaterial({vertexColors:true,toneMapped:false});
 const halo=new MeshBasicNodeMaterial({vertexColors:true,transparent:true,depthWrite:false,blending:AdditiveBlending,side:DoubleSide,forceSinglePass:true,toneMapped:false});
 // Static cross-section falloff; no pulse, clock, RNG or motion dependency.
 halo.opacityNode=float(1).sub(uv().x.sub(.5).abs().mul(2)).pow(3).mul(.16);
 return {core,halo};
}
