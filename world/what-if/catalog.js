export const PROJECTS = Object.freeze({
  park: {label:'Park', color:0x69bf83, assumption:'Adds a recreation destination and increases the nearest district’s environment score by 0.15 (capped at 1).'},
  grocery: {label:'Grocery store', color:0xf2bc65, assumption:'Adds a shopping destination and increases the nearest district’s services score by 0.15 (capped at 1).'},
  housing: {label:'Housing block', color:0x8baafa, assumption:'Adds 40 district housing units and assumes a 5% district rent reduction. Rent response is an explicit scenario assumption, not a market forecast.'},
  transit: {label:'Transit stop', color:0xc69af5, assumption:'Increases the nearest district’s transit access score by 0.20 (capped at 1). Existing model fares and capacity remain in effect; no new route is assumed.'},
});
export const COMPARISON_CONFIG = Object.freeze({population:200, seed:42});

export function placementBounds(context) {
  const b=context?.bounds;
  if(!b || ![b.minX,b.maxX,b.minZ,b.maxZ].every(Number.isFinite) || b.minX>=b.maxX || b.minZ>=b.maxZ)throw Error('Loaded neighborhood geometry is unavailable or invalid. Reload the neighborhood before placing a pin.');
  return {...b};
}

export function validateProject(project, context) {
  if(!project || !Object.hasOwn(PROJECTS,project.kind))throw Error('Choose a supported neighborhood addition.');
  if(Object.keys(project).some(key=>!['kind','x','z'].includes(key)))throw Error('Unsupported intervention parameters. Choose one listed addition; free-form policies are not modeled.');
  if(![project.x,project.z].every(Number.isFinite))throw Error('Choose a location on the map.');
  const b=placementBounds(context);
  if(project.x<b.minX || project.x>b.maxX || project.z<b.minZ || project.z>b.maxZ)throw Error(`Place the addition inside the original loaded neighborhood: E ${b.minX} to ${b.maxX} m; S ${b.minZ} to ${b.maxZ} m (edges included).`);
  return {kind:project.kind,x:project.x,z:project.z};
}

