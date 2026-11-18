import { createBlueprint, validateBlueprint } from '../blueprint/model.js';
import { POLICY_CATALOG, futureURL } from '../model.js';

export function createRoom(owner, name, blueprint = createBlueprint()) {
  if (!owner || !name?.trim()) throw new Error('Owner and display name required.');
  return { version: 'proposal-room.v1', revision: 0, blueprint: validateBlueprint(blueprint), owner,
    members: [{ token: owner, name: name.trim().slice(0, 60) }], proposals: [], comments: [], review: null };
}
function member(room, token) {
  const person = room?.members.find(row => row.token === token);
  if (!person) throw new Error('Access denied or room missing.');
  return person;
}
export function viewRoom(room, token) {
  member(room, token);
  return { ...structuredClone(room), owner: undefined,
    members: room.members.map(({name}) => ({name})),
    isOwner: token === room.owner };
}
// Entire command executes in a single IndexedDB read/write transaction. No last-writer replacement.
export function changeRoom(input, token, command) {
  const room = structuredClone(input);
  const person = member(room, token);
  const owner = token === room.owner;
  if (command.type === 'propose') {
    if (room.proposals.length >= 100) throw new Error('Room proposal limit reached.');
    const edit = validateBlueprint({ ...room.blueprint, edits: [command.edit], cosmetics: [] }).edits[0];
    if (!edit) throw new Error('Choose a proposal.');
    room.proposals.push({ id: `p${room.revision + 1}`, author: person.name, ...edit });
  } else if (command.type === 'comment') {
    if (room.comments.length >= 100 || typeof command.text !== 'string' || !command.text.trim() || command.text.length > 500) throw new Error('Comment must contain 1–500 characters; room limit 100.');
    room.comments.push({ author: person.name, text: command.text.trim() });
  } else if (command.type === 'review') {
    if (!owner) throw new Error('Only the owner may review.');
    if (command.revision !== room.revision) throw new Error('Draft changed. Review the latest revision.');
    if (!Array.isArray(command.ids) || new Set(command.ids).size !== command.ids.length || command.ids.some(id => !room.proposals.some(row => row.id === id))) throw new Error('Invalid proposal selection.');
    const selected = room.proposals.filter(row => command.ids.includes(row.id));
    const blueprint = validateBlueprint({ ...room.blueprint, edits: selected.map(({parcelId, policyId}) => ({parcelId, policyId})) });
    room.review = { revision: room.revision + 1, ids: [...command.ids], blueprint };
    room.revision++;
    return room;
  } else if (command.type === 'join') {
    throw new Error('Use explicit room opt-in.');
  } else throw new Error('Unsupported room command.');
  room.revision++;
  room.review = null;
  return room;
}
export function joinRoom(input, token, name) {
  if (!name?.trim() || !token || input.members.length >= 20) throw new Error('Display name required; room limit 20.');
  const room = structuredClone(input);
  if (room.members.some(row => row.token === token)) return room;
  if (room.members.some(row => row.name.toLowerCase() === name.trim().slice(0, 60).toLowerCase())) throw new Error('Choose a distinct display name for authorship.');
  room.members.push({ token, name: name.trim().slice(0, 60) });
  room.revision++; room.review = null;
  return room;
}
export function submitRoom(room, token, revision) {
  member(room, token);
  if (token !== room.owner) throw new Error('Only the owner may submit.');
  if (!room.review || revision !== room.revision || room.review.revision !== revision) throw new Error('Draft changed or review missing. Review again.');
  // A recipe handoff only: no saved run, authoritative City, or network writes.
  return futureURL({ ...room.review.blueprint.source, policies: room.review.blueprint.edits.map(row => row.policyId) });
}
export function proposalLabel(row) {
  return `${row.parcelId}: ${POLICY_CATALOG.find(policy => policy.id === row.policyId)?.label ?? 'Unsupported policy'} — ${row.author}`;
}
