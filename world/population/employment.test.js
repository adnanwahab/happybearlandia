import {test,expect} from 'bun:test';
import {createPopulationModel,stepPopulation,serializePopulation,restorePopulation,snapshotPopulation} from './model.js';
import {employmentCalendar,employmentSnapshot,inspectEmploymentWorker,consumeEmploymentPay,consumeEmployerPayroll,recordEmploymentInterval} from './employment.js';
import {normalizePopulationConfig} from './contracts.js';
const quiet={population:1,householdSize:1,employmentRate:1,medianIncome:60000,calendarStartEpochDay:20759,workIllnessDailyProbability:0,workFamilyLeaveDailyProbability:0,workVacationRequestProbability:0,workAfterHoursProbability:0,workShiftChangeProbability:0,workTurnoverDailyProbability:0,layoffRate:0,hiringRate:0,workRemoteEligibleShare:1};
const near={districts:[{id:'d',x:0,z:0,housingUnits:100,jobs:100}],buildings:[{id:'home',kind:'home',center:[0,0]},{id:'work',kind:'work',center:[0,0]}]};
function make(config={},context=near){const m=createPopulationModel({...quiet,...config},context);for(const b of m.economy.businesses)b.type='office';m.people.offset.fill(0);return m;}
function days(m,n){for(let day=0;day<n;day++)stepPopulation(m,{minutes:1440});return m;}

test('civil calendar, school weekends and summer camp share explicit real dates',()=>{
 const monday=make(),saturday=make({calendarStartEpochDay:20764});expect(employmentCalendar(monday)).toMatchObject({date:'2026-11-02',dayOfWeek:0,dayOfYear:305});expect(employmentCalendar(saturday).dayOfWeek).toBe(5);
 days(monday,1);days(saturday,1);expect(monday.metrics.employmentWorkedMinutes).toBeGreaterThan(0);expect(saturday.metrics.employmentWorkedMinutes).toBe(0);
 expect(()=>stepPopulation(monday,{minutes:15,config:{calendarStartEpochDay:20458}})).toThrow('reset');
});

test('paid sick leave changes actual absence pay and employer payroll, without changing the illness spell',()=>{
 const sick=days=>{const m=make({workUnpaidSickAbsenceProbability:1,workPaidSickDays:days});m.employment.sickUntilDay[0]=2;return m;};const a=days(sick(0),1),b=days(sick(10),1);
 expect(a.metrics.employmentWorkedMinutes).toBe(0);expect(b.metrics.employmentWorkedMinutes).toBe(0);expect(a.metrics.employmentPaidSickMinutes).toBe(0);expect(b.metrics.employmentPaidSickMinutes).toBe(510);
 expect(b.metrics.employmentWagesSettled).toBeGreaterThan(0);expect(b.metrics.employmentEmployerPayroll).toBeCloseTo(b.metrics.employmentWagesSettled);
 expect(b.people.income).toEqual(a.people.income);expect(b.employment.sickUntilDay).toEqual(a.employment.sickUntilDay);
 expect(b.households.savings[0]-a.households.savings[0]+b.households.spending[0]-a.households.spending[0]).toBeCloseTo(b.metrics.employmentWagesSettled-a.metrics.employmentWagesSettled);
});

test('vacation is actually taken and paid while reducing productive staffing',()=>{
 const normal=days(make(),1),vacation=days(make({workPaidVacationDays:5,workVacationRequestProbability:1}),1);
 expect(vacation.metrics.employmentPaidVacationMinutes).toBe(510);expect(vacation.metrics.employmentWorkedMinutes).toBe(0);expect(vacation.metrics.employmentWagesSettled).toBeGreaterThan(0);
 expect(vacation.metrics.employmentStaffingShortfallMinutes).toBeGreaterThan(normal.metrics.employmentStaffingShortfallMinutes);
 expect(vacation.economy.businesses[0].productivity).toBeLessThan(normal.economy.businesses[0].productivity);
});

test('four-day contracts reduce actual weekly work, retain declared annual pay and expose staffing shortfall',()=>{
 const five=days(make({workWeekDays:5}),7),four=days(make({workWeekDays:4}),7);
 expect(five.metrics.employmentWorkedMinutes).toBe(5*510);expect(four.metrics.employmentWorkedMinutes).toBe(4*510);
 expect(four.people.income[0]).toBe(five.people.income[0]);expect(four.metrics.employmentWagesSettled/five.metrics.employmentWagesSettled).toBeGreaterThan(.98);
 expect(four.metrics.employmentStaffingShortfallMinutes).toBeGreaterThan(five.metrics.employmentStaffingShortfallMinutes);
});

test('disconnect removes actual after-hours work and overtime pay rather than adding utility',()=>{
 const calls=days(make({workAfterHoursProbability:1,workDisconnect:0}),1),protectedTime=days(make({workAfterHoursProbability:1,workDisconnect:1}),1);
 expect(calls.metrics.employmentOvertimeMinutes).toBe(30);expect(protectedTime.metrics.employmentOvertimeMinutes).toBe(0);
 expect(calls.metrics.employmentWagesSettled).toBeGreaterThan(protectedTime.metrics.employmentWagesSettled);
 expect(calls.metrics.employmentEmployerPayroll).toBeGreaterThan(protectedTime.metrics.employmentEmployerPayroll);
});

test('predictable schedules remove recorded same-day shift changes and disclose advance notice',()=>{
 function run(flag){const m=make({population:80,workPredictableSchedule:flag,workShiftChangeProbability:1,workShiftVolatilityMinutes:60});for(const b of m.economy.businesses)b.type='retail';days(m,1);return m;}
 const changing=run(0),stable=run(1);expect(changing.metrics.employmentSameDayScheduleChanges).toBeGreaterThan(0);expect(stable.metrics.employmentSameDayScheduleChanges).toBe(0);
 expect(inspectEmploymentWorker(stable,0).schedulePublishedEpochDay).toBe(employmentCalendar(stable).epochDay-14);
});

test('eligible remote work uses HOME coordinates and changes actual onsite commute while remaining WORK',()=>{
 const context={districts:[{id:'a',x:0,z:0,jobs:1000,housingUnits:1000,transit:1},{id:'b',x:4000,z:0,jobs:1000,housingUnits:1000,transit:1}],buildings:[{id:'h',kind:'home',center:[0,0]},{id:'w',kind:'work',center:[4000,0]}]};
 function run(share){const m=make({population:40,workRemoteShare:share},context);for(let i=0;i<m.people.age.length;i++){m.people.home[i]=m.people.current[i]=0;m.people.homeX[i]=m.people.x[i]=0;m.people.homeZ[i]=m.people.z[i]=0;m.people.homeLocation[i]=m.people.currentLocation[i]=0;m.people.work[i]=1;m.people.workX[i]=4000;m.people.workZ[i]=0;m.people.workLocation[i]=1;}days(m,1);return m;}
 const office=run(0),remote=run(1);expect(office.metrics.employmentCommuteMinutes).toBeGreaterThan(0);expect(remote.metrics.employmentCommuteMinutes).toBe(0);expect(remote.metrics.employmentRemoteMinutes).toBeGreaterThan(0);
 expect(remote.metrics.employmentEmployerPayroll).toBeCloseTo(remote.metrics.employmentWagesSettled);
});

test('family leave requires actual guardian relationships and paid time enters the same wage ledger',()=>{
 const childContext={...near,buildings:[...near.buildings,{id:'school',kind:'school',center:[0,0]}]};
 const m=days(make({population:80,householdSize:4,workPaidFamilyDays:20,workFamilyLeaveDailyProbability:1,childcareCapacity:0},childContext),1);
 expect(m.children.indices.length).toBeGreaterThan(0);expect(m.metrics.employmentPaidFamilyMinutes).toBeGreaterThan(0);expect(m.metrics.employmentEmployerPayroll).toBeCloseTo(m.metrics.employmentWagesSettled);
 const noFamily=days(make({workPaidFamilyDays:20,workFamilyLeaveDailyProbability:1}),1);expect(noFamily.metrics.employmentPaidFamilyMinutes).toBe(0);
});

test('pay queues drain once, serialization continues exactly, and read-only worker inspection does not mutate',()=>{
 const a=days(make(),1),saved=serializePopulation(a),b=restorePopulation(saved);const before=JSON.stringify(saved);inspectEmploymentWorker(a,0);employmentSnapshot(a);expect(JSON.stringify(serializePopulation(a))).toBe(before);
 expect(consumeEmploymentPay(a,0)).toEqual({wages:0,benefits:0});expect(consumeEmployerPayroll(a,0)).toEqual({payroll:0,recruitment:0});
 days(a,1);days(b,1);expect(serializePopulation(a)).toEqual(serializePopulation(b));expect(snapshotPopulation(a).employment.metricUnits.employmentWagesSettled).toBe('USD');
});

test('calendar/shift/leave bounds reject invalid inputs and old behavior states reject',()=>{
 expect(()=>normalizePopulationConfig({workWeekDays:4.5})).toThrow();expect(()=>normalizePopulationConfig({workDisconnect:.5})).toThrow();expect(()=>normalizePopulationConfig({workShiftStartMinute:720,workShiftMinutes:600,workShiftVolatilityMinutes:120})).toThrow();
 const state=serializePopulation(make());state.modelVersion='1.2.0';expect(()=>restorePopulation(state)).toThrow('version');
});

test('every employed worker has an actual employer and closing it cannot create unbacked work or auto-transfer',()=>{
 const m=make();for(let i=0;i<m.people.employed.length;i++)if(m.people.employed[i])expect(m.employment.employer[i]).toBeGreaterThanOrEqual(0);
 m.economy.businesses[m.employment.employer[0]].open=false;stepPopulation(m,{minutes:15});expect(m.people.employed[0]).toBe(0);expect(m.employment.employer[0]).toBe(-1);expect(m.employment.headcount.reduce((a,b)=>a+b,0)).toBe(0);
 const prior=m.employment.totals.wagesAccrued;m.people.employed[0]=1;recordEmploymentInterval(m,0,1,480,60);expect(m.employment.totals.wagesAccrued).toBe(prior);
});

test('represented employer payroll reconciles to raw household wages using weight once',()=>{
 const m=days(make({population:10,representedPopulation:1000},{...near,districts:near.districts.map(d=>({...d,housingUnits:d.housingUnits*100,jobs:d.jobs*100}))}),1);
 expect(m.metrics.employmentEmployerPayroll/100).toBeCloseTo(m.metrics.employmentWagesSettled,6);
 expect(m.employment.householdWagesDue.every(value=>value===0)).toBe(true);expect(m.employment.employerPayrollDue.every(value=>value===0)).toBe(true);
});

test('recruitment consumes actual vacancies and employer budget without paying unworked hiring-day wages',()=>{
 function run(cash){const m=make({population:20,employmentRate:0,hiringRate:.5,workRecruitmentCost:1000});for(const firm of m.economy.businesses)firm.cash=cash;return days(m,1);}
 const funded=run(100000),unfunded=run(0);expect(funded.totals.hires).toBeGreaterThan(0);expect(unfunded.totals.hires).toBe(0);
 expect(funded.metrics.employmentRecruitmentCost).toBe(funded.totals.hires*1000);expect(funded.metrics.employmentWagesSettled).toBe(0);expect(funded.employment.employerRecruitmentDue.every(value=>value===0)).toBe(true);
 expect(funded.employment.headcount.reduce((a,b)=>a+b,0)).toBe(funded.people.employed.reduce((a,b)=>a+b,0));
});

test('observed unpaid absence drives the declared seeded turnover path, not a final utility offset',()=>{
 function run(rate){const m=make({population:100,workUnpaidSickAbsenceProbability:1,workSatisfactionUnpaidLeaveWeight:1,workTurnoverDailyProbability:rate});m.employment.sickUntilDay.fill(2);return days(m,1);}
 const retained=run(0),turnover=run(.1);expect(turnover.metrics.employmentVoluntaryQuits).toBeGreaterThan(0);expect(retained.metrics.employmentVoluntaryQuits).toBe(0);
 expect(turnover.eventCounts.JOB_QUIT).toBe(turnover.metrics.employmentVoluntaryQuits);expect(turnover.people.employed.reduce((a,b)=>a+b,0)).toBeLessThan(retained.people.employed.reduce((a,b)=>a+b,0));
});

test('declared weekly pay retention changes both actual pay and annual contract resource estimates once',()=>{
 const full=days(make(),1),half=days(make({workWeeklyPayRetention:.5}),1);
 expect(half.metrics.employmentWagesSettled).toBeCloseTo(full.metrics.employmentWagesSettled*.5);
 expect(half.households.income[0]-half.households.nonWage[0]).toBeCloseTo((full.households.income[0]-full.households.nonWage[0])*.5);
 expect(inspectEmploymentWorker(half,0).earnedWagesToDate).toBeCloseTo(half.metrics.employmentWagesSettled);
});
