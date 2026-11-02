import {CapacityRegistry, CONTRACTS, VERSION, clamp, draw, sum, validateState} from './contracts.js';
import {createSystemPacks} from './systems.js';
function freeze(value) { if(value && typeof value==='object') {Object.freeze(value); for(const v of Object.values(value))freeze(v);} return value; }
export function createEngine(packs = createSystemPacks()) {
  const ids = new Set(packs.map(p=>p.id));
  if(ids.size!==packs.length)throw new Error('Duplicate system pack');
  const ordered=[],pending=[...packs];
  while(pending.length) {
    const next=pending.filter(p=>(p.dependencies||[]).every(id=>ordered.some(p=>p.id===id))).sort((a,b)=>a.id.localeCompare(b.id))[0];
    if(!next)throw new Error('Missing or cyclic system dependency');
    for(const method of ['initialize','proposeStep','resolve','commit','observe'])if(typeof next[method]!=='function')throw new Error(`Missing ${method}`);
    ordered.push(next);pending.splice(pending.indexOf(next),1);
  }
  return {
    manifest:ordered.map(({id,version,cadence,dependencies})=>({id,version,cadence,dependencies})),
    initialize(state) {const next=structuredClone(state);for(const p of ordered)p.initialize(next);validateState(next);return next;},
    step(state) {
      validateState(state);
      const snapshot=freeze(structuredClone(state)),next=structuredClone(state),time=state.month+1;
      next.month=time; next.flows=[];
      const registry=new CapacityRegistry(),events=[],decisions=[],moves=[],trips=[];
      for(const resource of ['contractors','labor','materials','equipment','permits','administration'])registry.register({resource,time,capacity:state.parameters[resource]});
      const context={time,registry,events,decisions,moves,trips,
        random:(...keys)=>draw(state.seed,time,...keys),
        event(system,type,geographyId,payload={},severity=1) {const event={schemaVersion:CONTRACTS.SystemEvent,id:`${time}-${events.length}`,simulationTime:time,system,eventType:type,geographyId,severity,payload,modelId:system,modelVersion:VERSION};events.push(event);return event;},
        flow(resource,from,to,amount,system) {if(!Number.isFinite(amount)||amount<0)throw new Error('Invalid resource flow');next.flows.push({schemaVersion:CONTRACTS.ResourceFlow,time,resource,from,to,amount,system});},
        decision(system,actorId,type,chosenOption,primaryReason,alternatives=[]) {decisions.push({simulationTime:time,actorType:system,actorId,decisionType:type,chosenOption,primaryReason,alternatives,modelId:system,modelVersion:VERSION});}
      };
      const active=ordered.filter(p=>time%p.cadence===0);
      // All proposals see exactly STATE(t); no proposal observes a sibling's mutation.
      const proposals=active.map(p=>({schemaVersion:CONTRACTS.MarketProposal,system:p.id,time,value:p.proposeStep(snapshot,{time,random:context.random})}));
      // Explicit dependency graph controls constraint resolution on a private draft.
      const resolutions=active.map((p,i)=>({schemaVersion:CONTRACTS.MarketResolution,system:p.id,time,value:p.resolve(snapshot,proposals[i].value,next,context)}));
      for(const [i,p] of active.entries())p.commit(next,resolutions[i].value,context);
      const observations=active.flatMap(p=>p.observe(next,context).map(o=>({schemaVersion:CONTRACTS.CityObservation,simulationTime:time,geographyType:'city',geographyId:'city',system:p.id,modelVersion:p.version,...o})));
      validateState(next);
      const diagnostics=[];
      for(const d of next.districts) {
        const units=next.units.filter(u=>u.districtId===d.id),vacant=units.filter(u=>u.status==='available').length;
        if(!vacant)diagnostics.push({system:'housing',districtId:d.id,message:'Housing market has no available inventory'});
      }
      if(next.links.some(l=>l.flow>l.capacity*2))diagnostics.push({system:'transport',message:'Transport assignment capacity stress; single-pass assignment, not equilibrium'});
      return {state:next,proposals,resolutions,observations,events,decisions,moves,trips,flows:next.flows,capacities:registry.rows.map(row=>registry.query(row)),diagnostics};
    },
    run(initial,months=12) {if(!Number.isInteger(months)||months<1||months>1200)throw new Error('Invalid horizon');let state=this.initialize(initial);const steps=[];for(let i=0;i<months;i++){const result=this.step(state);steps.push(result);state=result.state;}return {state,steps,manifest:this.manifest};}
  };
}
export function cityMetrics(s) {
  return {population:sum(s.households,h=>h.size),households:s.households.length,housingUnits:s.units.length,availableUnits:s.units.filter(u=>u.status==='available').length,
    meanRent:s.units.length?sum(s.units,u=>u.rent)/s.units.length:0,unhoused:s.households.filter(h=>!h.unitId).length,
    employed:s.workers.filter(w=>w.jobId).length,jobs:s.jobs.length,businesses:s.businesses.filter(b=>b.status==='open').length,
    meanTravelMinutes:s.links.length?sum(s.links,l=>l.travelTime)/s.links.length:0,
    overloadedServices:s.facilities.filter(f=>f.utilization>1).length,utilityFailures:s.utilities.filter(u=>u.serviceLevel<1).length,
    balance:s.finance.balance,debt:s.finance.debt,completedProjects:s.projects.filter(p=>p.stage==='completion').length};
}
export function addIntervention(state,input) {
  const allowed=['housing','transit','utility','school','resilience','upzone'];
  if(!input||!allowed.includes(input.type)||!state.districts.some(d=>d.id===input.districtId))throw new Error('Invalid intervention type or district');
  const amount=input.amount??1,cost=input.cost??0;
  if(!Number.isFinite(amount)||amount<=0||amount>100000||!Number.isFinite(cost)||cost<0||cost>1e12)throw new Error('Invalid intervention amount/cost');
  const s=structuredClone(state);s.revision++;
  s.policies.push({id:`policy-${s.revision}-${s.policies.length}`,districtId:input.districtId,type:input.type,amount,cost,stage:'PROPOSED',adoption:0,compliance:clamp(input.compliance??1,0,1),delay:Math.max(0,Math.round(input.delay??0)),utility:input.utility||'sewer'});
  if(!['electric','water','sewer','stormwater'].includes(input.utility||'sewer')||!Number.isFinite(input.compliance??1)||!Number.isFinite(input.delay??0))throw new Error('Invalid intervention parameters');
  s.provenance.worldRevision=`revision-${s.revision}`;return s;
}
export function scheduleShock(state,shock) {
  if(!shock||!['flood','heat','rate','recession','materials'].includes(shock.type)||!Number.isInteger(shock.start)||shock.start<=state.month||!Number.isInteger(shock.duration)||shock.duration<1||!Number.isFinite(shock.severity)||shock.severity<0||shock.severity>1||!state.districts.some(d=>d.id===shock.districtId))throw new Error('Invalid shock');
  const s=structuredClone(state);s.shocks.push({...shock,id:`shock-${s.shocks.length}`});return s;
}
