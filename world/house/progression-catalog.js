/** Static practice capabilities, independent of the employment/house runtime cycle. */
export const HOUSE_SKILLS=Object.freeze({cooking:'Cooking',gardening:'Gardening',creativity:'Creativity',logic:'Logic',charisma:'Charisma',handiness:'Handiness',fitness:'Fitness',programming:'Programming',music:'Music',painting:'Painting',repair:'Repair'});
const practice=(label,objectTypes,skill,minLevel,durationMinutes,pose,needRates)=>({label,objectTypes,skill,minLevel,durationMinutes,minAge:6,roomId:'living',pose,needRates,requires:['selected installed object',`${HOUSE_SKILLS[skill]} level ${minLevel}`],mechanism:'Actual attended practice advances the named skill. Advanced work creates a retained project and game-point reward, not cash or extra wages.'});
export const PROGRESSION_ACTIONS=Object.freeze({
 practiceMusic:practice('Practice music',['music'],'music',1,30,'idle',{energy:-.035,fun:.08}),
 practiceProgramming:practice('Practice programming',['computer'],'programming',1,30,'computer',{energy:-.04,fun:.035}),
 workOut:practice('Work out',['rug'],'fitness',1,30,'clean',{energy:-.07,fun:.07}),
 writeProgram:practice('Build a software project',['computer'],'programming',3,60,'computer',{energy:-.05,fun:.08}),
 paintMasterpiece:practice('Paint a gallery piece',['artEasel'],'painting',3,60,'clean',{energy:-.045,fun:.13}),
 performMusic:practice('Perform a practiced piece',['music'],'music',3,45,'idle',{energy:-.04,fun:.12}),
 enduranceWorkout:practice('Complete an endurance workout',['rug'],'fitness',3,45,'clean',{energy:-.09,fun:.10})
});
