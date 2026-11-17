import { fetchCheckpoint, residentIndex } from '../civilization/families/history.js';
import { compatiblePopulationContinuation } from '../population/population-growth.js';

const TYPES = {
  HOUSEHOLD_MOVED: ['moving-in', 'Household moved'],
  HOUSE_ROOMMATE_ACCEPTED: ['moving-in', 'Roommate co-residence agreed'],
  HOUSE_ROOMMATE_MOVED_OUT: ['household', 'Roommate returned home'],
  JOB_FOUND: ['job', 'Job found'], JOB_LOST: ['job', 'Job lost'], JOB_QUIT: ['job', 'Job left'],
  HOUSE_CHILD_BORN: ['household', 'Child born'], HOUSE_CHILD_ADOPTED: ['household', 'Child adopted'],
};
const RELATIONSHIPS = new Set(['first-date','breakup','proposal','wedding','separation','divorce','family-planning']);
export const MILESTONE_CATEGORIES = ['moving-in','job','relationship','household'];

// IDs and ticks belong exclusively to the compatible Population branch.
export function householdMilestones(checkpoints, householdId) {
  const found = new Map();
  for (const checkpoint of checkpoints) {
    const {model, stepMinutes} = checkpoint;
    const belongs = id => {const i = residentIndex(model, id); return i >= 0 && model.prefix+'-h'+model.people.household[i] === householdId;};
    const relevant = row => row.householdId === householdId ||
      (row.householdId == null && [row.personId,...(row.personIds ?? [])].some(belongs));
    function add(row, category, title, sourcePath, id, tick) {
      if (!relevant(row) || typeof id !== 'string' || !id || !Number.isSafeInteger(tick) || tick < 0 ||
          !Number.isFinite(row.minute) || row.minute < 0 || row.minute !== tick*stepMinutes ||
          row.minute > model.minute || tick > checkpoint.tick) return;
      const key = category+':'+id;
      if (found.has(key)) return;
      const exact = checkpoints.find(c => c.tick === tick && c.model.minute === row.minute);
      found.set(key, {id:key,category,title,tick,minute:row.minute,checkpointId:checkpoint.id,sourcePath,
        source:structuredClone(row),seekId:exact?.id ?? null});
    }
    for (const [index,event] of (model.events ?? []).entries()) {
      const type = TYPES[event.type];
      if (type && event.schemaVersion === 'event.v2' && event.modelVersion === model.modelVersion && event.synthetic === true)
        add(event,...type,'model.events['+index+']',event.id,event.tick);
    }
    for (const [key,tie] of Object.entries(model.social?.ties ?? {})) {
      for (const [index,row] of (tie.commitmentMilestones ?? []).entries()) {
        if (typeof row.actionId !== 'string' || !row.actionId || !RELATIONSHIPS.has(row.event) || !Array.isArray(row.personIds) || row.personIds.length !== 2 ||
            !row.personIds.includes(tie.a) || !row.personIds.includes(tie.b)) continue;
        // Canonical commitment records have minutes, not ticks. The saved runtime
        // pins the Population clock conversion; off-grid records are rejected.
        add(row,'relationship',row.event.replaceAll('-',' '),'model.social.ties['+JSON.stringify(key)+'].commitmentMilestones['+index+']',
          key+':'+row.actionId,row.minute/stepMinutes);
      }
    }
  }
  return [...found.values()].sort((a,b)=>b.tick-a.tick || a.id.localeCompare(b.id));
}

export async function loadHouseholdMilestones(experimentId, householdId, options={}) {
  const checkpoints = [], seen = new Set();
  let id = experimentId, notice = '';
  while (id && checkpoints.length < 8) {
    if (seen.has(id)) {notice='Invalid parent link ended saved history.'; break;}
    let current;
    try {current=await fetchCheckpoint(id,options);} catch(error) {
      if (options.signal?.aborted) throw error;
      if (!checkpoints.length) throw error;
      notice='Earlier history unavailable. '+error.message; break;
    }
    const child=checkpoints.at(-1);
    if (child && (current.tick>child.tick || current.model.minute>child.model.minute ||
        current.stepMinutes!==child.stepMinutes || !compatiblePopulationContinuation(current.model,child.model))) {
      notice='Earlier history has incompatible Population identity or clock.'; break;
    }
    checkpoints.push(current); seen.add(id); id=current.parentId;
  }
  if (id && checkpoints.length===8) notice='Showing at most eight saved checkpoints.';
  return {rows:householdMilestones(checkpoints,householdId),notice};
}
