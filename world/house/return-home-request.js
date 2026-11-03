import {activeResidentDate} from './resident-location.js';

/** Explicit home return must release the date reservation before moving the Sim. */
export async function endResidentDateForHome(runtime,person,data={}){
 const date=activeResidentDate(person,data);if(!date)return null;
 const householdId=date.householdId??data.home?.householdId??data.household?.id;
 if(!householdId)throw Error('The active date’s household could not be resolved. Open the date to return home.');
 const result=await runtime.householdSystemCommand({householdId,system:'dates',type:'end',dateId:date.id,travelMode:'instant'});
 if(result?.accepted!==true)throw Error(result?.reason??'The date could not be ended. Please try again.');
 return result;
}
