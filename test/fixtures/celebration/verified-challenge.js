import {createCity} from '../../../world/city/seed.js';
import {createChallengeEnvelope,verifyChallenge} from '../../../world/challenges/contract.js';
// Explicit synthetic housing shortage; same seed and frozen state for both arms.
export async function representativeCelebration() {
 const state=createCity({households:6,seed:42});
 for(const parcel of state.parcels)parcel.capacity=0;
 for(const unit of state.units){unit.householdId=null;unit.status='under construction';}
 for(const household of state.households)household.unitId=null;
 for(const utility of state.utilities)utility.capacity=10000;
 const envelope=await createChallengeEnvelope({initialState:state,seed:42,months:20,budget:5000,
  actions:[{id:'housing',label:'Build two synthetic homes',intervention:{type:'housing',districtId:'d0',amount:2,cost:1000}}],
  referenceSelection:[],metrics:['unhousedHouseholds'],guards:{employmentNotBelowReference:false}});
 return {envelope,result:await verifyChallenge(envelope,{selection:['housing']})};
}
