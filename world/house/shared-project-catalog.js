export const SHARED_PROJECT_LIMITS=Object.freeze({dailyMinutes:120,minDays:3,minContributors:2,history:12});
export const SHARED_WORK_TYPES=Object.freeze({handiness:'sharedBuild',gardening:'sharedPlant',creativity:'sharedCreate',logic:'sharedPlan',charisma:'sharedCollect'});
const task=(id,label,skill,target,minAge)=>({id,label,skill,target,minAge});
export const SHARED_PROJECTS=Object.freeze({
 vegetables:{label:'Our vegetable garden',object:'herbs',roomId:'garden',cost:90,tasks:[task('beds','Build the growing beds','handiness',90,12),task('plant','Plant and tend the vegetables','gardening',150,6),task('signs','Make the garden signs','creativity',60,6)]},
 treehouse:{label:'Our family treehouse',object:'tree',roomId:'garden',cost:240,tasks:[task('plan','Plan the treehouse','logic',90,12),task('build','Build the platform and ladder','handiness',180,16),task('decorate','Decorate our hideaway','creativity',90,6)]},
 album:{label:'Our family photo album',object:'books',roomId:'living',cost:45,tasks:[task('stories','Collect photos and family stories','charisma',90,6),task('pages','Arrange the album pages','creativity',120,6),task('bind','Bind the album','handiness',90,12)]},
});
