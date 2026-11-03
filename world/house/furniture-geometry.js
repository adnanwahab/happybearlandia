import {BATHROOM_FOOTPRINTS,BATHROOM_PLACEMENTS} from './basic-needs.js';
import {EXTRA_OBJECT_FOOTPRINTS,EXTRA_OBJECT_PLACEMENTS} from './extra-objects.js';
import {ACTIVITY_OBJECT_FOOTPRINTS,ACTIVITY_OBJECT_PLACEMENTS} from './activities.js';
/** Canonical synthetic room coordinates used by both inferred and mapped views.
 * The renderer maps this envelope into its frozen source-footprint room proxy.
 * These are inventory collision proxies, not measured interior/survey geometry. */
export const HOUSE_PLACEMENT_RULES=Object.freeze({schemaVersion:'house-placement.v1',space:'room-local',units:'synthetic-interior-units',width:6.6,depth:5.6,minX:-10,maxX:10,minZ:-10,maxZ:10,wallInset:0,clearance:.1,grid:.05,rotationStep:Math.PI/2,maxObjects:64,source:'Bounded room-local coordinates. Visible floor and wall geometry constrain the placement preview; this envelope is not an invisible wall inside a mapped room.'});
export const FURNITURE_FOOTPRINTS=Object.freeze({...BATHROOM_FOOTPRINTS,...EXTRA_OBJECT_FOOTPRINTS,...ACTIVITY_OBJECT_FOOTPRINTS,plant:{width:.7,depth:.7},flowers:{width:1.2,depth:.8},herbs:{width:1.4,depth:.8},tree:{width:1.6,depth:1.6},roseBush:{width:1.2,depth:1.2},bed:{width:2.9,depth:3.6},couch:{width:3.8,depth:1.6},stove:{width:1.4,depth:1.3},diningTable:{width:3.95,depth:3.2},desk:{width:2.8,depth:2.1},books:{width:1.2,depth:.65},music:{width:.8,depth:.65},lamp:{width:.8,depth:.8}});
export const DEFAULT_OBJECT_PLACEMENTS=Object.freeze({...BATHROOM_PLACEMENTS,...EXTRA_OBJECT_PLACEMENTS,...ACTIVITY_OBJECT_PLACEMENTS,plant:{x:-2.6,z:1.8,rotation:0},flowers:{x:-2.5,z:1.8,rotation:0},herbs:{x:-2.4,z:-1.8,rotation:0},tree:{x:-2.2,z:1.7,rotation:0},roseBush:{x:-2.5,z:1.8,rotation:0},bed:{x:-.8,z:-.5,rotation:0},couch:{x:-.8,z:-.1,rotation:0},stove:{x:1,z:-1.8,rotation:0},diningTable:{x:-.3,z:1.1,rotation:0},desk:{x:.5,z:-.7,rotation:0},books:{x:2.5,z:-1.9,rotation:0},music:{x:2.5,z:1.7,rotation:0},lamp:{x:2.6,z:.1,rotation:0}});
const check=(ok,message)=>{if(!ok)throw Object.assign(new Error(message),{name:'HouseActionError'});};
export function canonicalFurniturePlacement(value){
 check(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>['x','z','rotation'].includes(k))&&[value.x,value.z,value.rotation??0].every(Number.isFinite),'Placement requires finite room-local x, z and rotation only');
 check(Math.abs(value.x)<=10&&Math.abs(value.z)<=10&&Math.abs(value.rotation??0)<=Math.PI*4,'Placement is outside the canonical coordinate/rotation bounds');
 const turn=(value.rotation??0)/(Math.PI/2),quarter=Math.round(turn);check(Math.abs(turn-quarter)<1e-6,'Furniture rotation must be a quarter turn');
 return{x:Number((Math.round(value.x/.05)*.05).toFixed(3)),z:Number((Math.round(value.z/.05)*.05).toFixed(3)),rotation:((quarter%4+4)%4)*Math.PI/2};
}
export function effectiveObjectPlacement(object){return object.placement?{...object.placement}:DEFAULT_OBJECT_PLACEMENTS[object.type]?{...DEFAULT_OBJECT_PLACEMENTS[object.type]}:null;}
export function furnitureBounds(type,placement){const size=FURNITURE_FOOTPRINTS[type];check(size,'Unknown furniture footprint');const quarter=Math.round(placement.rotation/(Math.PI/2)),width=quarter%2?size.depth:size.width,depth=quarter%2?size.width:size.depth;return{minX:placement.x-width/2,maxX:placement.x+width/2,minZ:placement.z-depth/2,maxZ:placement.z+depth/2,width,depth};}
function overlaps(a,b){const c=HOUSE_PLACEMENT_RULES.clearance;return a.minX<b.maxX+c-1e-8&&a.maxX>b.minX-c+1e-8&&a.minZ<b.maxZ+c-1e-8&&a.maxZ>b.minZ-c+1e-8;}
/** Pure admission geometry; installed and pending objects share one inventory. */
export function validateFurniturePlacement(house,{type,roomId,placement,replaceObjectId=null}){
 check(house.rooms.some(room=>room.id===roomId),'Placement room is not in this actual household');const canonical=canonicalFurniturePlacement(placement),box=furnitureBounds(type,canonical),r=roomId==='garden'?{...HOUSE_PLACEMENT_RULES,minX:-3.3,maxX:3.3,minZ:-2.8,maxZ:2.8}:HOUSE_PLACEMENT_RULES;
 check(box.minX>=r.minX+r.wallInset-1e-8&&box.maxX<=r.maxX-r.wallInset+1e-8&&box.minZ>=r.minZ+r.wallInset-1e-8&&box.maxZ<=r.maxZ-r.wallInset+1e-8,'Furniture footprint crosses the canonical room boundary');
 for(const object of house.objects){if(object.roomId!==roomId||object.id===replaceObjectId||type==='rug'||object.type==='rug')continue;const pose=effectiveObjectPlacement(object);if(pose)check(!overlaps(box,furnitureBounds(object.type,pose)),'HOUSE_PLACEMENT_OCCUPIED: footprint overlaps installed '+object.id);}
 for(const action of house.actions){if(action.type!=='furniture'||action.roomId!==roomId||type==='rug'||action.object==='rug')continue;const pose=action.placement??DEFAULT_OBJECT_PLACEMENTS[action.object];if(pose)check(!overlaps(box,furnitureBounds(action.object,pose)),'HOUSE_PLACEMENT_OCCUPIED: footprint overlaps pending installation '+action.id);}
 return canonical;
}

/** Beds retain their standard physical dimensions in every mapped room. */
export function furnitureDisplayScale(type,roomScale=1){return type==='bed'?1:roomScale;}
