/** The population model's absolute minute is the only simulation clock. */
export function createWorldClock(model,{initialMinute=360,isPaused=()=>false}={}){
 return {snapshot(){const minute=model.minute,day=Math.floor(minute/1440),minuteOfDay=minute-day*1440;return{minute,absoluteMinute:minute,initialMinute,elapsedMinutes:minute-initialMinute,day,year:Math.floor(day/365),minuteOfDay,hour:minuteOfDay/60,tick:model.tick,paused:isPaused(),calendar:'illustrative 365-day years; day0 starts at minute0',initialization:'clock offset only; no overnight burn-in'};}};
}
export function validateInitialMinute(minute){if(!Number.isFinite(minute)||minute<0||minute>5256000)throw new Error('initialMinute must be 0–5256000 finite model minutes');return minute;}
