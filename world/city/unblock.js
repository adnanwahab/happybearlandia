import {createEngine,cityMetrics} from './engine.js';
import {validateState,VERSION} from './contracts.js';

export const UNBLOCK_FIXES = Object.freeze({
  sewer:{label:'Add sewer capacity',kind:'utility'},water:{label:'Add water capacity',kind:'utility'},
  electric:{label:'Add electric capacity',kind:'utility'},stormwater:{label:'Add stormwater capacity',kind:'utility'},
  labor:{label:'Add construction labor',kind:'capacity'},permits:{label:'Add monthly permit slots',kind:'capacity'},
  contractors:{label:'Add contractor capacity',kind:'capacity'},materials:{label:'Add materials capacity',kind:'capacity'},equipment:{label:'Add equipment capacity',kind:'capacity'},
});
function check(state,projectId) {
  validateState(state);
  if(Object.values(state).filter(Array.isArray).reduce((n,rows)=>n+rows.length,0)>20000)throw new Error('This saved city exceeds the inspector size limit');
  const project=state.projects.find(p=>p.id===projectId);
  if(!project)throw new Error('Project is absent from this saved month');
  return project;
}
const eventsFor=(step,project)=>step.events.filter(e=>e.payload?.projectId===project.id||project.policyId&&e.payload?.policyId===project.policyId);
export function inspectProject(state,projectId) {
  const project=check(state,projectId),step=createEngine().step(state),next=step.state.projects.find(p=>p.id===projectId);
  const events=eventsFor(step,project),constraints=events.filter(e=>e.payload.reason).map(e=>({reason:e.payload.reason,event:e.eventType,month:e.simulationTime}));
  const utilities=state.utilities.filter(u=>u.districtId===project.districtId).map(u=>{
    const capacity=step.capacities.find(r=>r.resource===u.type&&r.districtId===project.districtId);
    return {utility:u.type,capacity:u.capacity,available:capacity?.available??0,required:project.type==='housing'?project.units:0};
  });
  let suggested=constraints.map(c=>c.reason==='permit delay'?'permits':c.reason).find(r=>Object.hasOwn(UNBLOCK_FIXES,r));
  if(constraints.some(c=>c.reason==='utility capacity'))suggested=utilities.find(u=>u.available<u.required)?.utility;
  return {project:structuredClone(project),month:state.month,nextMonth:step.state.month,nextStage:next.stage,events,constraints,utilities,
    capacities:step.capacities.filter(r=>r.districtId==='*').map(({resource,capacity,used,available})=>({resource,capacity,used,available})),suggested:suggested||'labor',
    note:constraints.length?'Recorded constraints from the next simulated month. Test a fix to see whether another constraint still binds.':'No delay is recorded for this project in the next month. Capacity figures alone do not establish a bottleneck.'};
}
export function compareProjectFix({state,projectId,fix,months=24,source=null}={}) {
  const project=check(state,projectId),spec=UNBLOCK_FIXES[fix?.resource];
  if(project.stage==='completion'||project.stage==='abandoned')throw new Error('Choose an unfinished project');
  if(!spec||!Number.isFinite(fix.amount)||fix.amount<=0||fix.amount>100000||!Number.isFinite(fix.cost)||fix.cost<0||fix.cost>1e12)throw new Error('Choose a supported resource, positive amount up to 100,000 and a nonnegative cost');
  if(spec.kind==='capacity'&&['permits'].includes(fix.resource)&&!Number.isInteger(fix.amount))throw new Error('Permit slots must be whole numbers');
  if(!Number.isInteger(months)||months<1||months>60||months*Math.max(1,state.households.length)>120000)throw new Error('Use 1–60 months within the 120,000 household-month limit');
  if(spec.kind==='utility'&&!state.utilities.some(u=>u.type===fix.resource&&u.districtId===project.districtId))throw new Error('The district has no matching utility service area');
  if(fix.cost>Math.max(0,state.finance.balance))throw new Error('The city cannot fund this fix from its saved cash balance. Reduce the cost or choose another saved month.');
  function run(changed) {
    const engine=createEngine();let current=structuredClone(state),completionMonth=null,publicCost=0,capitalCost=0;
    if(changed) {
      if(spec.kind==='utility') {
        // The added district capacity is divided across service-area rows, never multiplied.
        const areas=current.utilities.filter(u=>u.type===fix.resource&&u.districtId===project.districtId);
        for(const area of areas)area.capacity+=fix.amount/areas.length;
      } else current.parameters[fix.resource]+=fix.amount;
      current.finance.balance-=fix.cost;current.finance.capitalExpense+=fix.cost;
    }
    const timeline=[],events=[];
    for(let i=0;i<months;i++) {
      const step=engine.step(current);current=step.state;
      if(Object.values(current).filter(Array.isArray).reduce((n,rows)=>n+rows.length,0)>20000)throw new Error('City growth exceeded the inspector size limit');
      const p=current.projects.find(p=>p.id===projectId),finance=current.systems.finance;
      if(p.stage==='completion'&&completionMonth===null)completionMonth=current.month;
      publicCost+=finance.publicCost;capitalCost+=finance.capitalExpense;
      timeline.push({month:current.month,stage:p.stage,progress:p.progress,duration:p.duration,publicCost:finance.publicCost});
      events.push(...eventsFor(step,project));
    }
    return {completionMonth,stage:current.projects.find(p=>p.id===projectId).stage,publicCost,capitalCost,balance:current.finance.balance,debt:current.finance.debt,metrics:cityMetrics(current),timeline,events};
  }
  const baseline=run(false),tested=run(true);
  return {schemaVersion:'project-unblock.v1',modelVersion:VERSION,source:structuredClone(source),projectId,seed:state.seed,startMonth:state.month,endMonth:state.month+months,
    fix:{...fix,districtId:project.districtId,scope:spec.kind==='utility'?'district utility capacity':'city-wide monthly capacity'},baseline,tested,
    monthsEarlier:baseline.completionMonth!==null&&tested.completionMonth!==null?baseline.completionMonth-tested.completionMonth:null,
    publicCostDelta:tested.publicCost-baseline.publicCost,capitalCostDelta:tested.capitalCost-baseline.capitalCost,
    assumptions:['Both continuations use the same saved state, seed, model and shocks.','Added capacity is available from the next month. This diagnostic assumes it can be procured immediately; it does not simulate an upgrade construction project.','The entered cost is an assumed one-time public outlay. Capacity staffing or recurring procurement costs are not inferred.','Public spending is city-wide capital plus operating spending within this horizon. Not completed within the horizon does not mean never completed.']};
}
