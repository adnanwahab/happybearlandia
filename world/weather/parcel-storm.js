// Synthetic gameplay flood envelope, not a hydraulic or meteorological forecast.
export const PARCEL_STORM_VERSION = 'parcel-storm.v1';
export function stormIntensityAt(storm, minute) {
  if (!storm) return 0;
  const age = Math.max(0, minute - storm.startedMinute);
  return storm.intensity * Math.max(0, Math.min(1, (90 - age) / 30));
}
export function updateParcelStorm(world) {
  const storm = world.policy?.storm;
  if (!storm) return;
  const age = Math.max(0, world.t - storm.startedMinute);
  // Depth rises for 20 minutes, then drains completely by minute 180.
  const envelope = age <= 20 ? .1 + .9 * age / 20 : Math.max(0, (180 - age) / 160);
  let flooded = 0;
  for (const b of world.buildings) {
    if (b.state.floodStormId !== storm.id) continue;
    b.state.floodDepthMeters = b.state.floodPeakDepthMeters * envelope;
    b.state.flooded = b.state.floodDepthMeters > 0;
    if (b.state.flooded) flooded++;
  }
  world.policy.floodedNow = flooded;
  storm.phase = age >= 180 ? 'recovered' : age >= 90 ? 'receding' : 'storm';
}
export function startParcelStorm(world, { floodedIds, intensity = 1, route }) {
  if (!Number.isFinite(intensity) || intensity < 0 || intensity > 1) throw new RangeError('Storm intensity must be 0–1');
  const ids = new Set(floodedIds);
  const storm = { version: PARCEL_STORM_VERSION, id: `storm:${world.t}:${(world.policy?.storm?.sequence ?? 0) + 1}`, sequence: (world.policy?.storm?.sequence ?? 0) + 1, startedMinute: world.t, intensity, seed: world.seedKey, source: 'Synthetic ranked-parcel gameplay exposure; no hydraulic calibration', floodedParcelIds: [], evacuations: [] };
  world.policy ??= {};
  world.policy.storm = storm;
  const bounds = poly => ({minX:Math.min(...poly.map(p=>p[0])),maxX:Math.max(...poly.map(p=>p[0])),minZ:Math.min(...poly.map(p=>p[1])),maxZ:Math.max(...poly.map(p=>p[1]))});
  const buildingBounds = world.buildings.map(b=>({b,...bounds(b.poly)}));
  for (const b of world.buildings) {
    const wet = intensity > 0 && b.kind !== 'park' && ids.has(b.index);
    b.state.flooded = wet;
    b.state.floodDepthMeters = 0;
    b.state.floodPeakDepthMeters = wet ? .3 + 1.2 * intensity : 0;
    b.state.floodStormId = wet ? storm.id : null;
    // No cadastral lots are supplied. An explicit synthetic 2m apron makes
    // shallow floodwater visible around the footprint; it is part of the run,
    // never inferred independently by a view. It is not surveyed flood extent.
    b.state.floodSurfacePoly = wet ? b.poly.map(([x,z]) => {
      const dx=x-b.center[0], dz=z-b.center[1], length=Math.hypot(dx,dz)||1;
      return [x+2*dx/length,z+2*dz/length];
    }) : null;
    if (wet) {
      // Conservatively suppress the apron if its bounds touch any other
      // footprint. Never paint a dry neighbor with this parcel's water.
      const extent=bounds(b.state.floodSurfacePoly);
      if(buildingBounds.some(other=>other.b!==b && extent.minX<=other.maxX && extent.maxX>=other.minX && extent.minZ<=other.maxZ && extent.maxZ>=other.minZ)) b.state.floodSurfacePoly=b.poly.map(p=>[...p]);
      storm.floodedParcelIds.push(String(b.id));
    }
  }
  const safeHomes = world.buildings.filter(b => b.kind === 'home' && !b.state.flooded);
  let displaced = 0;
  for (const p of world.people) {
    const home = world.buildings[p.home];
    if (!home?.state.flooded) continue;
    p.today.homeFlooded = true; p.today.displaced = true;
    const safe = safeHomes.reduce((best, b) => !best || Math.hypot(b.center[0]-home.center[0], b.center[1]-home.center[1]) < Math.hypot(best.center[0]-home.center[0], best.center[1]-home.center[1]) ? b : best, null);
    const evacuation = { personId: String(p.id), fromParcelId: String(home.id), toParcelId: safe ? String(safe.id) : null, startedMinute: world.t, status: safe ? 'walking' : 'no-safe-home' };
    storm.evacuations.push(evacuation);
    if (!safe) continue;
    displaced++;
    if (p.mode === 'doing' && world.buildings[p.target]) world.buildings[p.target].state.visitors = Math.max(0, world.buildings[p.target].state.visitors - 1);
    delete p.userCommand;
    p.home = safe.index;
    // Reuse the normal walking scheduler and road waypoints; never teleport.
    p.evacuation = { stormId: storm.id, fromParcelId: String(home.id), toParcelId: String(safe.id) };
    p.mode = 'moving'; p.action = null; p.target = safe.index;
    p.path = route(p, safe); p.pathI = 0;
    [p.tx, p.tz] = p.path[0] ?? safe.center;
    p.travelMode = 'walk'; p.transitWaitMinutesRemaining = 0;
    p.tripStartedMinute = world.t; p.tripDistanceMeters = p.path.reduce((sum, point, i) => sum + Math.hypot(point[0]-(i ? p.path[i-1][0] : p.x), point[1]-(i ? p.path[i-1][1] : p.z)), 0);
    p.tripTravelMinutes = 0; p.tripWalkMinutes = 0; p.tripTransitMinutes = 0; p.tripWaitMinutes = 0;
    p.doing = `evacuating to ${safe.name}`;
    p.needs.energy = Math.max(0, p.needs.energy - 12);
    p.needs.fun = Math.max(0, p.needs.fun - 15);
    p.needs.social = Math.max(0, p.needs.social - 10);
  }
  world.policy.displaced = displaced;
  updateParcelStorm(world);
  return { floodedNow: world.policy.floodedNow, displaced };
}
