/** Weather v1 — deterministic coarse environment inputs, not a forecast.
 * createWeatherSimulation({seed=42,initialMinute=360,parameters})
 * -> stepTo(minute),snapshot(),configure(patch),serialize(),restore(state).
 * Parameters: {automatic:true,temperatureC:22,rainIntensity:0,stormIntensity:0}.
 * Changing any manual condition switches automatic:false unless explicitly
 * overridden. All time comes from committed model minutes; no wall clock/RNG
 * sequence, history cache, electricity network, or population/economy stepping.
 * weatherEffects(snapshotOrConditions) returns the eight declared multipliers.
 * Canonical runtime supplies the snapshot as populationModel.weather, with
 * populationModel.weatherEffects as its effects view, before population steps.
 */
export const WEATHER_VERSION='weather.v1';
export const DEFAULT_WEATHER_PARAMETERS=Object.freeze({automatic:true,temperatureC:22,rainIntensity:0,stormIntensity:0});
export const WEATHER_LIMITS=Object.freeze({minTemperatureC:-40,maxTemperatureC:55,minIntensity:0,maxIntensity:1,maxMinute:52560000});
const copy=value=>structuredClone(value),clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
function validMinute(value){if(!Number.isFinite(value)||value<0||value>WEATHER_LIMITS.maxMinute)throw new Error('Weather minute must be finite, nonnegative and at most 52560000');return value;}
function validSeed(value){if(Number.isInteger(value)&&value>=0&&value<=4294967295)return String(value);if(typeof value==='string'&&value.length>0&&value.length<=128)return value;throw new Error('Weather seed must be uint32 or a bounded nonempty string');}
function validateConditions(input){for(const[key,min,max]of[['temperatureC',-40,55],['rainIntensity',0,1],['stormIntensity',0,1]])if(!Number.isFinite(input[key])||input[key]<min||input[key]>max)throw new Error(`${key} must be ${min}–${max}`);return input;}
function checkedParameters(patch,base=DEFAULT_WEATHER_PARAMETERS,{manualEdit=false}={}){if(!patch||typeof patch!=='object'||Array.isArray(patch)||Object.keys(patch).some(key=>!Object.hasOwn(DEFAULT_WEATHER_PARAMETERS,key)))throw new Error('Unknown or invalid weather parameters');const next={...base,...patch};if(manualEdit&&!Object.hasOwn(patch,'automatic')&&['temperatureC','rainIntensity','stormIntensity'].some(key=>Object.hasOwn(patch,key)))next.automatic=false;if(typeof next.automatic!=='boolean')throw new Error('Weather automatic must be boolean');validateConditions(next);return next;}
function draw(seed,...keys){let hash=2166136261;for(const character of[seed,...keys].join(':'))hash=Math.imul(hash^character.charCodeAt(0),16777619);hash=Math.imul(hash^(hash>>>16),2246822507);hash=Math.imul(hash^(hash>>>13),3266489909);return((hash^(hash>>>16))>>>0)/4294967296;}
function automaticConditions(seed,minute,parameters){const day=Math.floor(minute/1440),hour=Math.floor(minute/60),hourOfDay=minute%1440/60;
 const temperatureC=clamp(parameters.temperatureC+5*Math.cos((hourOfDay-14)/24*2*Math.PI)+(draw(seed,day,'temperature')-.5)*5,-40,55);
 const cloud=draw(seed,Math.floor(hour/3),'rain-system'),rain=cloud<.24?.2+draw(seed,hour,'rain-strength')*.65:0;
 const storm=cloud<.07&&draw(seed,hour,'storm-chance')<.4?.25+draw(seed,hour,'storm-strength')*.65:0;
 return{temperatureC,rainIntensity:Math.max(parameters.rainIntensity,rain,storm*.75),stormIntensity:Math.max(parameters.stormIntensity,storm)};
}
export function weatherEffects(input={}){if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Weather effects need condition inputs');const {temperatureC,rainIntensity,stormIntensity}=validateConditions({temperatureC:input.temperatureC??22,rainIntensity:input.rainIntensity??0,stormIntensity:input.stormIntensity??0}),heat=Math.max(0,temperatureC-28),cold=Math.max(0,8-temperatureC);
 return{walkComfort:clamp(1-.55*rainIntensity-.8*stormIntensity-.025*heat-.012*cold,.05,1),bikeComfort:clamp(1-.75*rainIntensity-.9*stormIntensity-.02*heat-.018*cold,.03,1),parkComfort:clamp(1-.7*rainIntensity-.9*stormIntensity-.045*heat-.02*cold,.02,1),electricityDemandMultiplier:1+.035*Math.max(0,temperatureC-24)+.02*Math.max(0,12-temperatureC),roadAvailability:clamp(1-.2*rainIntensity-.65*stormIntensity,.1,1),transitAvailability:clamp(1-.1*rainIntensity-.6*stormIntensity,.1,1),serviceAvailability:clamp(1-.55*stormIntensity,.2,1)};
}
function conditionFor({temperatureC,rainIntensity,stormIntensity}){return stormIntensity>.05?'storm':rainIntensity>.05?'rain':temperatureC>=32?'heat':temperatureC<=2?'cold':'clear';}
export function createWeatherSimulation({seed=42,initialMinute=360,parameters={}}={}){
 let currentSeed=validSeed(seed),now=validMinute(initialMinute),start=now,config=checkedParameters(parameters),revision=0;
 function snapshot(){const conditions=config.automatic?automaticConditions(currentSeed,now,config):{temperatureC:config.temperatureC,rainIntensity:config.rainIntensity,stormIntensity:config.stormIntensity};return{schemaVersion:WEATHER_VERSION,minute:now,initialMinute:start,seed:currentSeed,revision,condition:conditionFor(conditions),...conditions,parameters:copy(config),effects:weatherEffects(conditions),source:'seeded illustrative coarse weather; not observed or forecast meteorology',assumptions:['One spatially uniform weather cell; no atmospheric, hydraulic or physical electricity-network simulation.','Automatic conditions use absolute model hour/day counter draws and a daily temperature cycle. Step partition and wall time do not change the result.','Comfort, demand and availability multipliers are synthetic mechanism assumptions, not measured causal effects or downstream outcomes.','Electricity demand is a coarse heating/cooling multiplier, not kWh consumption, grid dispatch, network capacity or guaranteed outages.','No initial overnight period is executed. Conditions are evaluated at the explicit initial clock offset.'],retention:{historyRecords:0,method:'conditions regenerated from seed, absolute minute and current parameters'}};}
 return{
  stepTo(minute){const target=validMinute(minute);if(target<now)throw new Error('Weather clock cannot go backwards; restore a checkpoint');now=target;return snapshot();},
  snapshot,
  configure(patch){const next=checkedParameters(patch,config,{manualEdit:true});if(revision>=Number.MAX_SAFE_INTEGER)throw new Error('Weather revision budget exceeded');config=next;revision++;return snapshot();},
  serialize(){return{schemaVersion:WEATHER_VERSION,seed:currentSeed,minute:now,initialMinute:start,parameters:copy(config),revision};},
  restore(saved){if(saved?.schemaVersion!==WEATHER_VERSION)throw new Error('Unsupported weather state version');const nextSeed=validSeed(saved.seed),nextMinute=validMinute(saved.minute),nextStart=validMinute(saved.initialMinute),nextConfig=checkedParameters(saved.parameters);if(nextMinute<nextStart||!Number.isSafeInteger(saved.revision)||saved.revision<0)throw new Error('Inconsistent weather clock/revision');currentSeed=nextSeed;now=nextMinute;start=nextStart;config=nextConfig;revision=saved.revision;return snapshot();}
 };
}
