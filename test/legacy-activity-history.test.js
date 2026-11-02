import {test,expect} from 'bun:test';
import {buildTown} from '../world/gen.js';
import {createWorld,ACTIONS,WALK_M_PER_MIN} from '../world/sim.js';
function fixture(options={}){return createWorld(buildTown({lat:29.7286,lng:-95.4746},{source:'none'},{maxPeople:20}),{recordHistory:true,...options});}
test('legacy history conserves elapsed person-time, queries do not tick, and detail retention stays honest',()=>{
 const w=fixture();w.trackActivityPerson('0');w.step(180);
 const before=w.t,h=w.getActivityHistory({actorId:'0'});
 expect(h.totals.agentMinutes).toBe(20*180);
 expect(Object.values(h.totals.activityMinutes).reduce((a,b)=>a+b,0)).toBe(20*180);
 expect(h.buckets.reduce((a,b)=>a+b.agentMinutes,0)).toBe(20*180);
 expect(w.getActivitySnapshot().people.length).toBe(20);
 expect(w.getActivityHistory()).toMatchObject({coverage:{toMinute:w.t}});
 expect(w.t).toBe(before);
 expect(h.recentEvents.some(e=>e.type==='TRIP_STARTED')).toBe(true);
 expect(h.actorTimeline).toBeTruthy();
});
test('history recording does not change seeded people, resource outcomes or model decisions',()=>{
 const a=fixture({recordHistory:true}),b=fixture({recordHistory:false});a.step(240);b.step(240);
 const project=w=>({people:w.people.map(p=>({needs:p.needs,money:p.money,x:p.x,z:p.z,action:p.action,mode:p.mode})),stats:w.stats,buildings:w.buildings.map(b=>b.state)});
 expect(project(a)).toEqual(project(b));
 expect(b.getActivityHistory().available).toBe(false);
});
test('work and school are unavailable overnight, and an early worker waits without getting paid',()=>{
 const w=fixture({startMinute:449}),p=w.people[0],job=w.byKind.work[0];job.state.open=true;p.job=job.index;p.shiftStart=480;p.shiftLen=480;p.workedToday=false;
 const probe={...w,minuteOfDay:()=>60};expect(ACTIONS.work.ok(p,job,probe)).toBe(false);expect(ACTIONS.study.ok(p,job,probe)).toBe(false);
 Object.assign(p,{mode:'moving',action:'work',target:job.index,x:job.center[0],z:job.center[1],tx:job.center[0],tz:job.center[1],path:[[...job.center]],pathI:0,tripStartedMinute:w.t});
 const money=p.money;w.step(1);expect(p.action).toBe('wait_shift');expect(p.money).toBe(money);
 w.step(30);expect(p.action).toBe('work');expect(p.money).toBe(money);
 w.step(1);expect(p.money).toBeCloseTo(money+.3);
 expect(w.getActivityHistory().recentEvents.some(e=>e.activity==='WAIT_SHIFT')).toBe(true);
});
test('walking consumes a full distance budget across short intermediate road segments',()=>{
 const w=fixture(),p=w.people[0];Object.assign(p,{x:0,z:0,mode:'moving',action:'sleep',target:p.home,path:[[10,0],[20,0],[30,0],[40,0],[50,0],[100,0]],pathI:0,tx:10,tz:0,tripStartedMinute:w.t});
 w.step(1);expect(p.x).toBe(WALK_M_PER_MIN);expect(p.mode).toBe('moving');
 w.step(Math.ceil(100/WALK_M_PER_MIN)-1);expect(p.x).toBe(100);expect(p.mode).toBe('doing');
 const h=w.getActivityHistory();expect(h.totals.completedTrips).toBeGreaterThan(0);
 expect(h.recentEvents.find(e=>e.type==='TRIP_COMPLETED'&&e.personId==='0').travelMinutes).toBe(Math.ceil(100/WALK_M_PER_MIN));
});
test('all legacy people retain real routines before selection without a sixteen-person inspection limit',()=>{
 const w=fixture();w.step(180);
 for(const person of w.people){w.trackActivityPerson(String(person.id));const h=w.getActivityHistory({actorId:String(person.id)});expect(h.actorTimeline.intervals.length).toBeGreaterThan(0);expect(h.actorTimeline.intervals.reduce((sum,row)=>sum+row.endMinute-row.startMinute,0)).toBe(180);}
 const history=w.getActivityHistory({actorId:'19'});expect(history.actorTimeline.intervals.length).toBeLessThan(180);
 expect(history.actorTimeline.droppedEvents).toBeGreaterThanOrEqual(0);
});
