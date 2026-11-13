// Public legacy experiment transport bounds. Simulation rules remain in PlanSpec.
export const MAX_EXPERIMENT_BYTES = 64 * 1024;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = message => { throw new Error(message); };
const text = (value, field, max = 200) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) fail(`${field} must contain 1–${max} characters`);
};
export async function readExperimentInput(request) {
  const reader = request.body?.getReader();
  if (!reader) fail('Body must be a JSON object');
  const chunks = []; let size = 0;
  for (;;) {
    const {done, value} = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_EXPERIMENT_BYTES) { await reader.cancel(); const error = new Error('Body exceeds 64 KiB'); error.status = 413; throw error; }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let body;
  try { body = JSON.parse(new TextDecoder().decode(bytes)); } catch { fail('Body must be valid JSON'); }
  if (!object(body)) fail('Body must be a JSON object');
  return body;
}
export function validateExperimentInput(body) {
  if (!object(body)) fail('Body must be a JSON object');
  for (const field of ['seeds', 'years', 'maxPeople']) {
    if (body[field] !== undefined && (typeof body[field] !== 'number' || !Number.isFinite(body[field]))) fail(`${field} must be a finite number`);
  }
  if (body.baseSeed !== undefined) text(body.baseSeed, 'baseSeed', 64);
  if (body.package !== undefined) text(body.package, 'package');
  if (body.label !== undefined) text(body.label, 'label');
  if (body.procedural !== undefined && typeof body.procedural !== 'boolean') fail('procedural must be a boolean');
  if (body.location !== undefined) {
    const p = body.location;
    if (!object(p) || typeof p.lat !== 'number' || !Number.isFinite(p.lat) || Math.abs(p.lat) > 85 || typeof p.lng !== 'number' || !Number.isFinite(p.lng) || Math.abs(p.lng) > 180) fail('location requires numeric lat in [-85,85] and lng in [-180,180]');
    if (p.name !== undefined && p.name !== null) text(p.name, 'location.name');
  }
  if (body.checkpoints !== undefined && (!Array.isArray(body.checkpoints) || body.checkpoints.length > 11 || body.checkpoints.some(y => !Number.isInteger(y) || y < 0 || y > 10))) fail('checkpoints must contain at most 11 integer years from 0 to 10');
  if (body.proposalIds !== undefined) validateIds(body.proposalIds, 'proposalIds');
  if (body.plan !== undefined) validateImportedPlan(body.plan);
}
function validateIds(ids, field) {
  if (!Array.isArray(ids) || ids.length > 100) fail(`${field} must be an array of at most 100 proposal IDs`);
  ids.forEach(id => text(id, field, 96));
}
export function validateImportedPlan(plan) {
  if (Array.isArray(plan)) { validateIds(plan, 'plan'); return; }
  if (!object(plan)) fail('plan must be an object or proposal ID array');
  for (const field of ['planId', 'id', 'label', 'name', 'title', 'source']) if (plan[field] !== undefined) text(plan[field], `plan.${field}`);
  if (plan.proposalIds !== undefined) validateIds(plan.proposalIds, 'plan.proposalIds');
  if (plan.kind === 'planspec' && plan.version !== 1) fail('plan.version must be 1');
  const compiled = plan.kind === 'planspec';
  if (compiled && !Array.isArray(plan.actions)) fail('plan.actions must be an array');
  if (plan.package !== undefined && !object(plan.package)) fail('plan.package must be an object');
  const rows = compiled ? plan.actions : plan.items ?? plan.proposals ?? plan.package?.items;
  if (rows !== undefined) {
    if (!Array.isArray(rows) || rows.length > 100) fail('plan actions/items must be an array of at most 100 entries');
    rows.forEach((row, i) => {
      if (!object(row)) fail(`plan entry ${i} must be an object`);
      if (row.proposal !== undefined && !object(row.proposal)) fail(`plan entry ${i} proposal must be an object`);
      // Match the compiler's precedence: a nested proposal is ignored for PlanSpec.
      text(compiled ? row.proposalId : row.proposal?.id || row.proposalId || row.id || row.proposal_id, `plan entry ${i} proposalId`, 96);
      if (row.label !== undefined) text(row.label, `plan entry ${i} label`);
      if (row.proposal?.title !== undefined) text(row.proposal.title, `plan entry ${i} proposal.title`);
      const cost = compiled ? row.costB : row.proposal?.costB ?? row.costB;
      if (cost !== undefined && cost !== null && (typeof cost !== 'number' || !Number.isFinite(cost) || cost < 0 || cost > 1e6)) fail(`plan entry ${i} costB must be between 0 and 1000000`);
      if (row.startYear !== undefined && (!Number.isInteger(row.startYear) || row.startYear < 0 || row.startYear > 10)) fail(`plan entry ${i} startYear must be an integer from 0 to 10`);
    });
  }
}
