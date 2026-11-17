// Authored geometry only: no social model, geographic mapping, or run outputs.
export const city = Object.freeze({version:'tabletop-geometry/1', source:'HBL authored synthetic geometry', coordinates:'Local fictional metres; origin (0,0); no geographic coordinates', buildings:Object.freeze([
  Object.freeze({id:'home',x:-20,z:-15,width:16,depth:14,height:12}),
  Object.freeze({id:'library',x:20,z:-15,width:20,depth:14,height:9}),
  Object.freeze({id:'tower',x:20,z:20,width:14,depth:16,height:25}),
  Object.freeze({id:'shop',x:-20,z:20,width:18,depth:16,height:7})
])});
export function validCity(data) {
  return !!data?.buildings?.length && data.buildings.every(b=>['x','z','width','depth','height'].every(k=>Number.isFinite(b[k])) && b.width>0 && b.depth>0 && b.height>0);
}
export function scaleValue(value) { return Math.max(0.002,Math.min(0.01,Number(value)||0.005)); }
export async function startSession(xr, data=city) {
  if (!validCity(data)) throw new Error('City geometry missing. Use the 2D view when data is restored.');
  if (!xr) throw new Error('WebXR AR unavailable on this browser. Use the 2D view.');
  return xr.requestSession('immersive-ar',{requiredFeatures:['hit-test'],optionalFeatures:['dom-overlay'],domOverlay:{root:globalThis.document?.getElementById('controls')}});
}
