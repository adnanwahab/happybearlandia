// Local tangent-plane meters match world/gen.js and world/api.js. Geographic
// stepping follows the loaded dataset square, not an arbitrary camera grid.
export const METERS_PER_MILE=1609.344;
export function geographicTileBounds(area={},town={}) {
  if(area.source==='osm'&&Number.isFinite(area.radiusM)&&area.radiusM>0){if(area.bbox&&town.origin&&['s','w','n','e'].every(k=>Number.isFinite(area.bbox[k]))){const o=town.origin,kx=111320*Math.cos(o.lat*Math.PI/180);return {minX:(area.bbox.w-o.lng)*kx,maxX:(area.bbox.e-o.lng)*kx,minZ:-(area.bbox.n-o.lat)*110540,maxZ:-(area.bbox.s-o.lat)*110540,label:'Loaded map square',source:'osm-query',navigationOrigin:area.origin||{lat:(area.bbox.s+area.bbox.n)/2,lng:(area.bbox.w+area.bbox.e)/2},radiusM:area.radiusM};}const r=area.radiusM,requested=town.origin||area.origin,center=area.origin||requested;const x=requested&&center?(center.lng-requested.lng)*111320*Math.cos(requested.lat*Math.PI/180):0,z=requested&&center?-(center.lat-requested.lat)*110540:0;return {minX:x-r,maxX:x+r,minZ:z-r,maxZ:z+r,label:'Loaded map square',source:'osm-query',navigationOrigin:center,radiusM:r}}
  const points=(town.roads||[]).flatMap(road=>road.pts||[]).filter(p=>Array.isArray(p)&&p.every(Number.isFinite));
  if(!points.length)return null;
  return {minX:Math.min(...points.map(p=>p[0])),maxX:Math.max(...points.map(p=>p[0])),minZ:Math.min(...points.map(p=>p[1])),maxZ:Math.max(...points.map(p=>p[1])),label:town.source==='osm'?'Loaded road extent':'Generated neighborhood extent',source:town.source==='osm'?'loaded-roads':'generated-roads'};
}
export function areaUnits(squareMeters){return {squareMeters,squareKilometers:squareMeters/1e6,squareMiles:squareMeters/(METERS_PER_MILE**2)}};
export function adjacentTileOrigin(origin,bounds,direction) {
  const width=bounds.maxX-bounds.minX,depth=bounds.maxZ-bounds.minZ;
  const offsets={north:[0,depth],south:[0,-depth],east:[width,0],west:[-width,0]};
  if(!offsets[direction]||!Number.isFinite(width)||width<=0||!Number.isFinite(depth)||depth<=0)throw new Error('A finite loaded tile and cardinal direction are required.');
  const [east,north]=offsets[direction],anchor=bounds.navigationOrigin||origin,lat=anchor.lat+north/110540,lng=anchor.lng+east/(111320*Math.cos(anchor.lat*Math.PI/180));
  if(Math.abs(lat)>85||!Number.isFinite(lng))return null;
  return {lat,lng:((lng+180)%360+360)%360-180};
}
export function polygonArea(points) {let area=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];area+=a[0]*b[1]-b[0]*a[1]}return Math.abs(area)/2}
// Planes are Three frustum planes projected onto y=0: nx*x+nz*z+c >=0.
// Clipping is finite even if a top screen ray points above the horizon.
export function clipGroundToFrustum(bounds,planes) {
  let polygon=[[bounds.minX,bounds.minZ],[bounds.maxX,bounds.minZ],[bounds.maxX,bounds.maxZ],[bounds.minX,bounds.maxZ]];
  for(const plane of planes){const next=[];for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],da=plane.nx*a[0]+plane.nz*a[1]+plane.c,db=plane.nx*b[0]+plane.nz*b[1]+plane.c,insideA=da>=-1e-8,insideB=db>=-1e-8;if(insideA)next.push(a);if(insideA!==insideB){const t=da/(da-db);next.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])])}}polygon=next;if(!polygon.length)break}
  return polygon;
}
export function adjacentNavigationQuery(search,origin,cameraState) {
  const q=new URLSearchParams(search);for(const key of ['simulation','reality','decisionExperiment','decisionRun','experiment','run','month','share','readonly','seed'])q.delete(key);q.set('lat',origin.lat.toFixed(7));q.set('lng',origin.lng.toFixed(7));
  // Camera coordinates stay local to the next tile, preserving zoom/orientation.
  if(cameraState)q.set('tileCamera',JSON.stringify(cameraState));return q;
}
export function mountTileNavigation({container,area,town,origin,camera,controls,THREE,navigate,groundBounds={minX:-800,maxX:800,minZ:-800,maxZ:800}}) {
  const doc=container.ownerDocument,root=doc.createElement('section'),bounds=geographicTileBounds(area,town);root.className='tile-navigation';root.setAttribute('aria-label','Neighborhood tile navigation');
  root.innerHTML='<div class="tile-arrows"><span>Next neighborhood</span><button type="button" data-tile="north" aria-label="Load adjacent neighborhood to the north">↑ N</button><button type="button" data-tile="west" aria-label="Load adjacent neighborhood to the west">← W</button><button type="button" data-tile="east" aria-label="Load adjacent neighborhood to the east">E →</button><button type="button" data-tile="south" aria-label="Load adjacent neighborhood to the south">S ↓</button></div><div class="muted" data-tile-size></div><div class="muted" data-view-size></div><details><summary>What these sizes mean</summary><p class="muted">Neighborhood size follows the loaded map query or generated road extent. Visible loaded area is the camera frustum intersected with the loaded extent on flat ground; it changes with zoom, rotation, and window shape. It includes ground behind buildings and overlay panels, not terrain surface area. Cached map tiles use their stored center. Moving tiles reloads a new neighborhood; residents restart while your view and URL options are kept.</p></details>';
  container.append(root);
  const fmt=value=>new Intl.NumberFormat(undefined,{maximumFractionDigits:3}).format(value),formatArea=m2=>{const u=areaUnits(m2);return `${fmt(u.squareMiles)} mi² / ${fmt(u.squareKilometers)} km²`};
  if(bounds){const width=bounds.maxX-bounds.minX,depth=bounds.maxZ-bounds.minZ;root.querySelector('[data-tile-size]').textContent=`${bounds.label}: ${formatArea(width*depth)} · ${fmt(width/METERS_PER_MILE)} × ${fmt(depth/METERS_PER_MILE)} miles per side`;}else{root.querySelector('[data-tile-size]').textContent='Loaded extent unavailable.';for(const b of root.querySelectorAll('button'))b.disabled=true}
  const matrix=new THREE.Matrix4(),frustum=new THREE.Frustum();let last='',destroyed=false;
  function update(){if(destroyed)return;camera.updateMatrixWorld();matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(matrix,camera.coordinateSystem);const planes=frustum.planes.map(p=>({nx:p.normal.x,nz:p.normal.z,c:p.constant}));const areaM=bounds?polygonArea(clipGroundToFrustum(bounds,planes)):0,text=bounds?`Visible loaded area: ≈${formatArea(areaM)}`:'Visible loaded area unavailable.';if(text!==last){last=text;root.querySelector('[data-view-size]').textContent=text;root.dataset.visibleSquareMeters=String(areaM)}}
  function click(event){const direction=event.target.closest('[data-tile]')?.dataset.tile;if(!direction||!bounds)return;const next=adjacentTileOrigin(origin,bounds,direction);if(!next){root.querySelector('[data-tile-size]').textContent='The next tile is outside supported geographic bounds.';return}navigate(next,{position:camera.position.toArray(),target:controls.target.toArray()},bounds);}
  const resize=()=>doc.defaultView.requestAnimationFrame(update);root.addEventListener('click',click);controls.addEventListener('change',update);doc.defaultView.addEventListener('resize',resize);update();
  return {update,destroy(){destroyed=true;root.removeEventListener('click',click);controls.removeEventListener('change',update);doc.defaultView.removeEventListener('resize',resize);root.remove()}};
}
