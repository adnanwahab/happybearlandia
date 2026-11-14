// Authored cosmetic atmosphere, not observed weather or a simulation input.
const clamp=x=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const smooth=x=>{const t=clamp(x);return t*t*(3-2*t);};
export function outdoorLighting(daylight=0,twilight=0,weather='clear') {
 const day=clamp(daylight),warm=smooth(twilight),cloud=weather==='rain'?1:weather==='cloudy'?.55:0;
 return {warm,exposure:Math.min(.85,.78+.07*smooth(day)),fogDensity:.00018+.00012*warm+.00012*cloud,
   skyIntensity:.12+.46*day,shadowStrength:smooth(day/.35)*(1-.65*cloud)};
}
// One bounded approximate cascade. Follow the view target, keeping the existing
// sun direction. No extra render passes, textures, transparent layers or timers.
export function updateOutdoorShadow(sun,target,settings,strength,enabled=true) {
 const radius=Math.min(400,Math.max(160,settings.distance*.25));
 const shadow=sun.shadow,camera=shadow.camera;
 const offset=sun.position.clone().sub(sun.target.position);
 sun.target.position.set(target.x,0,target.z);sun.position.copy(sun.target.position).add(offset);
 if(camera.right!==radius){Object.assign(camera,{left:-radius,right:radius,top:radius,bottom:-radius,near:.5,far:1800});camera.updateProjectionMatrix();}
 sun.castShadow=Boolean(enabled&&settings.shadows&&strength>0);
 shadow.intensity=strength;
}

export function disposeOutdoorShadow(sun) {
 sun.shadow.dispose();sun.shadow.map=null;sun.shadow.mapPass=null;
}
