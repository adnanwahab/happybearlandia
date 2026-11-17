/** Cosmetic junction areas from shared road vertices, never surveyed crosswalks. */
export function crossingAreas(roads=[]){
 const nodes=new Map();
 for(const [roadIndex,road] of roads.entries())for(const point of road.pts||[]){
  const [x,z]=point;if(!Number.isFinite(x)||!Number.isFinite(z))continue;
  const key=`${x.toFixed(2)}:${z.toFixed(2)}`;
  if(!nodes.has(key))nodes.set(key,{x,z,roads:new Set()});nodes.get(key).roads.add(roadIndex);
 }
 return [...nodes.values()].filter(node=>node.roads.size>1).slice(0,128).map(({x,z})=>({x,z,radius:8}));
}
/** Each distinct sampled walker supports at most one area. No extrapolation,
 * route snapping, clock advancement or inference from district trip totals. */
export function crossingGroups(rows=[],areas=[]){
 const groups=new Map(),seen=new Set();
 for(const row of rows){
  const trip=row.trip,id=row.id??row.personId;
  if(id==null||seen.has(String(id)))continue;seen.add(String(id));
  if(row.mode!=='walk'||!Number.isFinite(row.x)||!Number.isFinite(row.z)||
   !Number.isFinite(trip?.remainingMinutes)||!(trip.remainingMinutes>0)||
   !Number.isFinite(trip.durationMinutes)||trip.remainingMinutes>trip.durationMinutes||
   !Number.isFinite(trip.departureMinute))continue;
  let nearest=-1,distance=Infinity;
  areas.forEach((area,i)=>{const d=Math.hypot(row.x-area.x,row.z-area.z);if(d<=area.radius&&d<distance){distance=d;nearest=i;}});
  if(nearest<0)continue;
  if(!groups.has(nearest))groups.set(nearest,{...areas[nearest],count:0});groups.get(nearest).count++;
 }
 return [...groups.values()];
}
