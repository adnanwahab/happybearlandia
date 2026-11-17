// Authored local-world coordinates, not observed roads or traffic counts.
export const FIXTURE = Object.freeze({version:'urban-noise.v1', seed:null, source:'authored synthetic road segments', segments:Object.freeze([
  Object.freeze({id:'demo-east-west', ax:-200, az:0, bx:200, bz:0}),
  Object.freeze({id:'demo-north-south', ax:80, az:-200, bx:80, bz:200}),
])});
export function proximity(listener, fixture = FIXTURE) {
  if (!Number.isFinite(listener?.x) || !Number.isFinite(listener?.z) || fixture?.version !== 'urban-noise.v1' || !Array.isArray(fixture.segments) || !fixture.segments.length || fixture.segments.length > 32) return null;
  let distance = Infinity;
  for (const s of fixture.segments) {
    if (!s || ![s.ax,s.az,s.bx,s.bz].every(Number.isFinite)) return null;
    const dx=s.bx-s.ax, dz=s.bz-s.az, length=dx*dx+dz*dz;
    const t=length ? Math.max(0,Math.min(1,((listener.x-s.ax)*dx+(listener.z-s.az)*dz)/length)) : 0;
    distance=Math.min(distance,Math.hypot(listener.x-s.ax-t*dx,listener.z-s.az-t*dz));
  }
  // Synthetic artistic rolloff: half strength at 40 world units, zero at 400.
  return {distance, strength:distance>=400?0:1/(1+(distance/40)**2)};
}
