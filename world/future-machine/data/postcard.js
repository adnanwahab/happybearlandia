import {familyRecord} from './families.js';
import {explainChange} from '../story/index.js';

const fields=['income','savings','rent','burden'];
/** Unique, provenance-aligned monthly City observation; never fill a gap. */
export function postcardSnapshot(history,arm,month){
 const matches=(history?.[arm]??[]).filter(s=>s?.month===month);
 const s=matches.length===1?matches[0]:null;
 return Number.isInteger(month)&&month>=0&&month<=120&&s?.state?.month===month&&
  history?.seed!=null&&history?.modelVersion!=null&&s.state.seed===history.seed&&s.state.version===history.modelVersion?s:null;
}
/** Presentation only. Accept one exact observation per arm, on the declared City clock. */
export function householdPostcard(history,id,month){
 const arms={};
 for(const arm of ['baseline','plan']){
  const snapshot=postcardSnapshot(history,arm,month);
  const record=familyRecord(snapshot,id);
  // A finite rent and tiny positive income can still overflow their ratio.
  if(!Number.isFinite(record.observation.burden))record.observation.burden=null;
  arms[arm]={snapshot,record};
 }
 const a=arms.baseline.record,b=arms.plan.record;
 const complete=Boolean(a.household&&b.household)&&Number.isFinite(a.household.size)&&Number.isFinite(b.household.size)&&fields.every(k=>Number.isFinite(a.observation[k])&&Number.isFinite(b.observation[k]))&&a.observation.unitId!==null&&b.observation.unitId!==null;
 const unchanged=complete&&fields.every(k=>a.observation[k]===b.observation[k])&&a.observation.unitId===b.observation.unitId&&a.household.size===b.household.size;
 const receipts=explainChange({month,collection:'households',entityId:id},{a:arms.baseline.snapshot?.events??[],b:arms.plan.snapshot?.events??[]}).receipts;
 return {version:'household-postcard.v1',id,month,run:history?.experimentId??null,seed:history?.seed??null,modelVersion:history?.modelVersion??null,arms,
  status:!complete?'unavailable':unchanged?'unchanged':'changed',receipts};
}
