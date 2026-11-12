import { runLogistics, VERSION } from '../../tools/flowmap/logistics.js';
/** Synthetic fixture; these IDs do not assert that observed Houston roads were imported. */
export const BAKERY_IDS = Object.freeze({worldId:'world:fixture:houston-bakery', bakery:'business:fixture:houston-bakery', household:'household:fixture:bakery-worker', road:'road:fixture:bakery-direct'});
export function bakeryLogisticsInput({blocked=false}={}) {
  return {version:VERSION,context:{worldId:BAKERY_IDS.worldId},intervalHours:8,
    links:[{id:'link:fixture:direct',from:'supplier',to:'bakery',hours:.25,capacityPerHour:20,costPerUnit:1,closed:blocked},
      {id:'link:fixture:detour',from:'supplier',to:'bakery',hours:1,capacityPerHour:5,costPerUnit:3}],
    demands:[{id:'demand:fixture:flour',from:'supplier',to:'bakery',units:100}],
    roadMappings:[{roadId:BAKERY_IDS.road,linkIds:['link:fixture:direct']}]};
}
export async function calculateBakeryTransport(options={}) {
  if(Object.keys(options).some(k=>k!=='blocked') || (options.blocked!==undefined && typeof options.blocked!=='boolean')) throw new TypeError('Only boolean blocked intervention supported');
  const input=bakeryLogisticsInput(options);
  const result=await runLogistics(input);
  return {classification:'synthetic',ids:BAKERY_IDS,input,result};
}
