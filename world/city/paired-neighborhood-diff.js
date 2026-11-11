import {districtMetrics} from './neighborhood-metrics.js';
import {metricDelta} from '../future-machine/diff/core.js';

/** Project an already validated Future Machine pair; never select or run another simulation. */
export function pairedDistrictMetrics(frame,context={}) {
  const a=frame?.baseline?.state,b=frame?.plan?.state;
  if(!a||!b)throw new Error('Both district snapshots required');
  if(a.month!==b.month||a.month!==frame.month||a.seed!==b.seed||a.version!==b.version)throw new Error('Matched month, seed and model required');
  const baseline=districtMetrics(a,{...context,scenarioId:'baseline'});
  const plan=districtMetrics(b,{...context,scenarioId:'plan'});
  const key=r=>JSON.stringify([r.geographyId,r.metricId]);
  const left=new Map(baseline.map(r=>[key(r),r])),right=new Map(plan.map(r=>[key(r),r]));
  return [...new Set([...left.keys(),...right.keys()])].map(id=>{
    const before=left.get(id)??null,after=right.get(id)??null,row=before??after;
    const compatible=before&&after&&before.unit===after.unit&&before.status==='available'&&after.status==='available';
    return {geographyId:row.geographyId,districtName:row.districtName,metricId:row.metricId,month:frame.month,unit:row.unit,
      ...metricDelta(compatible?before.value:null,compatible?after.value:null,row.unit),
      coverage:{baseline:before?.coverage??null,plan:after?.coverage??null},
      // Keep full source rows separately from scalar values returned by metricDelta.
      sources:{baseline:before,plan:after}};
  });
}
