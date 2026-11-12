import { draw, hash } from '../../population/contracts.js';

export const IDEA_RULES = Object.freeze({
  version: 'population-idea-diffusion.v1',
  adoptionProbability: 0.65,
  remixProbability: 0.2,
  retentionMinutes: 1440,
  contactLimit: 512,
});

export const isExperimentId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{8,16}$/.test(value);

export function simulateIdeaSpread(source, { title, starterId, seed }) {
  const idea = typeof title === 'string' ? title.trim() : '';
  if (!idea || idea.length > 80) throw new Error('Enter an idea of 1–80 characters.');
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new Error('Enter a whole number from 0 to 4,294,967,295.');
  }
  const startingContact = source.contacts.find(contact => contact.pair.includes(starterId));
  if (!startingContact) throw new Error('Choose a resident with a retained contact.');

  const start = startingContact.minute;
  const active = new Map([[starterId, { variant: 'original', expires: start + IDEA_RULES.retentionMinutes }]]);
  const events = [{ kind: 'introduced', minute: start, personId: starterId, variant: 'original' }];
  const reached = new Set([starterId]);

  function expire(through) {
    for (const [personId, held] of active) {
      if (held.expires > through) continue;
      active.delete(personId);
      events.push({ kind: 'faded', minute: held.expires, personId, variant: held.variant });
    }
  }

  let minute;
  let adoptedThisMinute = new Set();
  for (const contact of source.contacts) {
    if (contact.minute < start) continue;
    if (contact.minute !== minute) {
      minute = contact.minute;
      expire(minute);
      adoptedThisMinute = new Set();
    }

    const [a, b] = contact.pair;
    if (active.has(a) === active.has(b)) continue;
    const [fromId, toId] = active.has(a) ? [a, b] : [b, a];
    // A new adoption may spread starting next minute, independent of simultaneous contact order.
    if (adoptedThisMinute.has(fromId)) continue;
    const original = active.get(fromId).variant === 'original';
    const contactSeed = hash(contact.id + '/' + fromId + '/' + toId);
    const adoptionDraw = draw(seed, contactSeed, minute, 0);
    const evidence = contact.evidence;
    if (adoptionDraw >= IDEA_RULES.adoptionProbability) {
      events.push({ kind: 'declined', minute, fromId, personId: toId, evidence, adoptionDraw });
      continue;
    }

    const remixed = original && draw(seed, contactSeed, minute, 1) < IDEA_RULES.remixProbability;
    const variant = remixed ? 'remix' : active.get(fromId).variant;
    active.set(toId, { variant, expires: minute + IDEA_RULES.retentionMinutes });
    adoptedThisMinute.add(toId);
    reached.add(toId);
    events.push({ kind: 'adopted', minute, fromId, personId: toId, variant, remixed, evidence, adoptionDraw });
  }

  expire(source.throughMinute);
  events.sort((a, b) => a.minute - b.minute);
  return {
    recipe: { version: IDEA_RULES.version, experimentId: source.experimentId, title: idea, starterId, seed },
    events,
    reached: reached.size,
    active: active.size,
  };
}
