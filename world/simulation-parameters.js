// Synthetic compatibility-model assumptions, not measured city estimates.
export const SIMULATION_PARAMETER_SCHEMA = Object.freeze(Object.fromEntries([
  ['walkMetersPerMinute',40,40,40,'m/min','Preserve the relaxed physical walking pace.'],
  ['transitMetersPerMinute',250,40,1000,'m/min','Illustrative road-following transit speed; no route network or GTFS.'],
  ['transitHeadwayMinutes',18,0,120,'minutes','Uniform counter-seeded arrival wait within an illustrative headway.'],
  ['transitWaitWeight',1.5,1,4,'multiplier','Waiting is weighted more heavily in trip choice, but recorded as actual minutes.'],
  ['transitFare',2,0,25,'currency/trip','A boarding fare paid from shared cash when transit is selected.'],
  ['minimumTransitDistanceMeters',400,0,10000,'meters','Avoid boarding transit for very short trips.'],
  ['workPayPerMinute',0.3,0,10,'currency/minute','Synthetic wage credited only during modeled work.'],
  ['dailyHousingCost',28,0,500,'currency/household/day','Simple recurring housing expense, charged once at midnight.'],
  ['dailyUtilitiesCost',7,0,100,'currency/household/day','Simple recurring utility expense; no debt, taxes or insurance model.'],
  ['voucherEligibilityCash',90,0,100000,'currency/household','Cash eligibility threshold, assessed once per household.'],
  ['electricityKwPerHousehold',1.2,0,20,'kW/household','Illustrative concurrent electricity demand, multiplied by weather load.'],
  ['electricityCapacityKwPerHousehold',2,0,50,'kW/household','Explicit assumed concurrent capacity; not measured infrastructure. Overload reduces coarse service availability.'],
  ['sampleDays',5,1,31,'modeled days','Representative annual sample; unsampled days accrue no activity or money.'],
].map(([key,value,min,max,unit,reason])=>[key,Object.freeze({value,min,max,unit,reason,source:'Declared synthetic modeling assumption',confidence:'low; uncalibrated'})])));
export const DEFAULT_SIMULATION_PARAMETERS = Object.freeze(Object.fromEntries(Object.entries(SIMULATION_PARAMETER_SCHEMA).map(([key,row])=>[key,row.value])));
export const SIMULATION_MODEL_METADATA = Object.freeze({schemaVersion:'legacy-simulation-parameters.v1',authority:'Legacy household/activity compatibility model only; canonical population-v2 remains separate.',moneySemantics:'person.money is an alias of its household cash. Never sum person.money to estimate wealth; sum households once.',transit:'Estimated road-path ride and wait; no observed stops, access walks, timetables, capacity or routes.',annualSamples:'Five modeled days per annual period by default; no annualization of money or demographic change.'});
export function resolveSimulationParameters(input={}) {
  const result={...DEFAULT_SIMULATION_PARAMETERS};
  for(const [key,value] of Object.entries(input)) {
    const row=SIMULATION_PARAMETER_SCHEMA[key];
    if(!row||!Number.isFinite(value)||value<row.min||value>row.max||(key==='sampleDays'&&!Number.isInteger(value)))throw new RangeError(`Invalid simulation parameter: ${key}`);
    result[key]=value;
  }
  return Object.freeze(result);
}
