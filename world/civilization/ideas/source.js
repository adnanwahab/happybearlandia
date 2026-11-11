import { readPopulationCheckpoint } from '../../population/checkpoint.js';
import { personProfile } from '../../house/profiles.js';
import { IDEA_RULES, isExperimentId } from './model.js';

/** Project successful social interactions from an immutable Population save. */
export function projectContacts(record) {
  if (record?.schemaVersion !== 'world-experiment-record.v1' || !isExperimentId(record.id) ||
      record.save?.schemaVersion !== 'world-experiment-save.v1' || record.save.mode !== 'living') {
    throw new Error('Choose a saved Living World checkpoint.');
  }
  const { model, runtime } = readPopulationCheckpoint(record.save.checkpoint);
  const prefix = model.prefix + '-p';
  const people = new Map();
  const contacts = [];

  function addContact({ minute, pair, collection, index, placeId = null, text = null }) {
    if (!Number.isSafeInteger(minute) || minute < 0 || minute > model.minute ||
        !Array.isArray(pair) || pair.length !== 2 || pair[0] === pair[1]) return;
    const indices = pair.map(id => typeof id === 'string' && id.startsWith(prefix)
      ? Number(id.slice(prefix.length))
      : NaN);
    if (indices.some((i, k) => !Number.isSafeInteger(i) || i < 0 ||
        i >= model.people.age.length || pair[k] !== prefix + i)) return;

    for (const [k, id] of pair.entries()) {
      if (!people.has(id)) {
        const i = indices[k];
        people.set(id, { id, name: personProfile(model, i).name ?? `Resident ${i + 1}` });
      }
    }
    contacts.push({
      id: `${collection}-${index}`,
      minute,
      pair: [...pair],
      evidence: { experimentId: record.id, collection, index, placeId, text },
    });
  }

  const commands = runtime.socialTimeline;
  const oldest = Math.max(0, commands.length - IDEA_RULES.contactLimit);
  for (let index = oldest; index < commands.length; index++) {
    const command = commands[index];
    if (command?.action !== 'talk' || !Number.isSafeInteger(command.tick) || command.tick > runtime.tick) continue;
    addContact({
      collection: 'socialTimeline', index, minute: command.tick * runtime.stepMinutes,
      pair: [command.id, command.targetId],
    });
  }

  const encounters = Array.isArray(model.hotspots?.encounters) ? model.hotspots.encounters : [];
  const firstEncounter = Math.max(0, encounters.length - IDEA_RULES.contactLimit);
  for (let index = firstEncounter; index < encounters.length; index++) {
    const encounter = encounters[index];
    if (!encounter) continue;
    addContact({
      collection: 'hotspotEncounters', index, minute: encounter.minute, pair: encounter.personIds,
      placeId: encounter.placeId, text: encounter.text,
    });
  }
  contacts.sort((a, b) => a.minute - b.minute || a.id.localeCompare(b.id, 'en', { numeric: true }));
  const window = contacts.slice(-IDEA_RULES.contactLimit);
  const represented = new Set(window.flatMap(contact => contact.pair));
  return {
    experimentId: record.id,
    checksum: record.checksum,
    label: record.save.label,
    populationVersion: model.modelVersion,
    populationSeed: model.config.seed,
    throughMinute: model.minute,
    truncated: oldest > 0 || firstEncounter > 0 || window.length < contacts.length,
    people: [...people.values()].filter(person => represented.has(person.id)),
    contacts: window,
  };
}
