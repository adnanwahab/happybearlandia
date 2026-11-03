NPC roommate core integration, Models owner

Before Studio's module assignment arrived, roommates.js and core integration had already landed. Core currently imports these exports:
- moveInHouseRoommate(model,input,{careConstraint}) -> accepted result with command {tick,minute,kind:'roommate-in',request}
- moveOutHouseRoommate(model,input) -> accepted result with command {tick,minute,kind:'roommate-out',request}
- roommateHome(model,index) -> host financial household index, or null (moving-out counts as null)
- roommateAtHouse(model,index,hostIndex) -> actual physical presence
- roommateIndices(model,hostIndex) -> actual co-resident indices excluding moving-out
- physicalHouseMembers(model,hostIndex) -> original contiguous financial members excluding moved-away co-residents, plus incoming NPC roommates
- inspectHouseRoommates(model,householdId) -> actual rows with id,index,name,ageYears,roommate:true,atHome,role,financialHouseholdId,phase,status,canMoveOut
- advanceHouseRoommates(model) -> actual arrival reconciliation, called before and after each committed subinterval
- updateRoommateArrival(model,index,minute) -> normal travel arrival hook
- validateHouseRoommates(model) -> additive checkpoint/restore validation

Existing registry schema house-roommates.v1: model.houseRoommates={nextId,active:{[actualIndex]:{id,personId,index,household:hostIndex,financialHousehold:originalIndex,sourceHome:{district,x,z,location},destination:{district,x,z,location},phase:'moving-in'|'resident'|'moving-out',requestedMinute,...}},completed:[]}. No financial-membership change. household.start/size and people.household remain immutable.

New Studio plan may use acceptHouseRoommate with admitted guest + exact mutual consent and rent/day. Models will adapt worker dispatch to that function; preserve compatibility helper exports above or notify Models before replacing them. A sourceHome shape change needs adapter updates together. Existing runtime APIs are moveInHouseRoommate(input) and moveOutHouseRoommate(input); UI may pass hostPersonId, consentingPersonIds and rentPerDay once pure admission allows them. Present runtime wrappers impose only bounded actual household/person IDs and JSON length, so those extra fields can pass through.

Core house inspection exposes home.roommates and appends these actual people to home.guests for existing selectable-resident rendering, marking roommate:true/guest:false. home.life uses physicalHouseMembers; needs/activities share actual population arrays. Normal work/school schedule remains authoritative, with no long visit activity hold. Current module does not require a forced travel command: changed home anchors are reached by normal schedules, allowing work first. Moving-out restores original anchor without touching current position. If final module returns a walk descriptor, Models must decide how it respects mandatory work schedules.

Model integration hooks now available: configureHouseLife, prepareConfiguredHouseLife, advanceConfiguredHouseLife, guest door admission, observed next-house-event, queue commands, skills/projects/promotion boundaries, Hug/Cuddle, and full-checkpoint validation. Source file roommates.js now belongs to Studio; Models will not overlap further module edits.
