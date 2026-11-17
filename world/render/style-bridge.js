export const supportsStyleBridge = facades => facades.some(f=>typeof f?.setStyle==='function');
// Presentation only. Callers retain all entity, camera, geometry and model ownership.
export function createStyleBridge() {
  let value=0,target=0;
  return {
    set(valueNext,{immediate=false}={}) {
      if(!Number.isFinite(valueNext)||valueNext<0||valueNext>1)throw new RangeError('Style must be between 0 and 1');
      target=valueNext;if(immediate)value=target;
    },
    update(dt,{immediate=false}={}) {
      const step=Math.max(0,Number.isFinite(dt)?dt:0)*3;
      value=immediate?target:value+Math.sign(target-value)*Math.min(Math.abs(target-value),step);
      return value;
    },
    getState(){return {value,target};}
  };
}
