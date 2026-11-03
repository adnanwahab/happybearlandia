import {createDateSystem} from './date-system.js';
import {createFamilySystem} from './family-system.js';
import {createEmotionSpatialSystem} from './spatial-adapter.js';
import {registerHouseholdSystem} from './system-registry.js';
import * as social from './social-systems.js';
import * as lab from './lab-system.js';
import * as spatial from './spatial-system.js';
import {houseBuildGeometry} from './build-adapter.js';
import {HOUSE_FURNITURE} from './model.js';
let installed=false;
export function installHouseSystems(){if(installed)return;installed=true;
 registerHouseholdSystem({id:'lab',command:lab.applyLabCommand,inspect:lab.inspectLabSystem,validate:lab.validateLabSystem,advance:(model,home,{startMinute,endMinute})=>lab.advanceLabSystem(model,home,endMinute-startMinute)});
 registerHouseholdSystem({id:'social',command:social.applyHouseSocialCommand,inspect:social.inspectHouseSocialSystems,validate:social.validateHouseSocialSystems,actions:{...social.SOCIAL_SYSTEM_ACTIONS,groupConversation:{...social.SOCIAL_SYSTEM_ACTIONS.groupConversation,objectTypes:undefined,minParticipants:3,maxParticipants:4,requiresPartner:true},holidayMeal:{...social.SOCIAL_SYSTEM_ACTIONS.holidayMeal,minParticipants:2,maxParticipants:4},chatOnline:{...social.SOCIAL_SYSTEM_ACTIONS.chatOnline,screen:true},writeStory:{...social.SOCIAL_SYSTEM_ACTIONS.writeStory,screen:'computer'},doHomework:{...social.SOCIAL_SYSTEM_ACTIONS.doHomework,screen:'computer'}},actionPlan:(model,home,request,participants)=>{for(const i of participants){const check=social.socialActionAvailability(model,home,i,request);if(!check.available)return check;}if(request.type==='groupConversation')social.planGroupConversation(model,home,participants.map(i=>model.prefix+'-p'+i));if(request.type==='holidayMeal'&&home.preparedServings<participants.length)return{available:false,reason:'Prepare enough real servings for the celebration'};return{available:true};},admitAction:(model,home,action)=>{if(action.type==='holidayMeal')home.preparedServings-=action.participants.length;},advance:(model,home,{startMinute,endMinute})=>social.advanceHouseSocialSystems(model,home,startMinute,endMinute),completeAction:(model,home,action,minute)=>{if(action.participants.length<=4)social.recordHouseSocialCompletion(model,home,action,minute);}});
 registerHouseholdSystem(createEmotionSpatialSystem({catalog:HOUSE_FURNITURE}));
 registerHouseholdSystem(createFamilySystem());
 registerHouseholdSystem(createDateSystem());
}
