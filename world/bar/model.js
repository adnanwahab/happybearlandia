/* PUBLIC CONTRACT for the /world/bar UI.
 * createNight(previous?) -> state; loadNight(rawJSONOrObject) -> validated state.
 * applyAction(state, action) -> {state, ok, message, reactions:[{patronId,tone,text}], event?:string}.
 * Actions: talk {patronId,lineId}; group-talk {groupId,lineId}; buy {drinkId,target:'self'|patronId|groupId}; invite {patronId,kind:'contact'|'date'}; end-night; new-night.
 * getPatronView(state,id) -> {patron,stage,stageIndex,options,rapport,chemistry,status,canAsk,canRecover,history,contactStatus,offered}.
 * recover {patronId} is also available for one missed-line recovery per patron.
 * getGroupView(state,id) -> {group,stage,prompt,options,history,done}.
 * getSummary(state) -> {night,budget,spent,drinksBought,laughs,connections,contacts,bestMoment,ended}.
 * safeReturnTo(value) -> relative /world/house URL or /world/house.
 * state: {version:1,night:1,budget:60,spent:0,ended:false,contacts:[],patrons:{[id]:{stage:0,rapport:0,chemistry:0,history:[],invited:false,outcome:null}},groups:{[id]:{usedLines:[],history:[]}},purchases:[],offers:[],log:[],laughs:0}.
 * History entries: {lineId,text,reaction,tone}. Log entries {kind,message}.
 * Contacts: {patronId,name,kind,night}. Group turns use opener then story. Each patron has one optional recovery after a miss.
 * Cash is fictional. Drink purchases never increase chemistry. No intoxication state.
 */

import {PATRONS, DRINKS, GROUPS, GROUP_LINES, EVENTS} from './content.js';

export const BAR_SAVE_KEY = 'happybearlandia:bar:v1';
export const STARTING_BUDGET = 60;
export const STAGES = ['opener', 'story', 'flirt'];
const patronById = new Map(PATRONS.map(patron => [patron.id, patron]));
const drinkById = new Map(DRINKS.map(drink => [drink.id, drink]));
const groupById = new Map(GROUPS.map(group => [group.id, group]));
const eventById = new Map(EVENTS.map(event => [event.id, event]));
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const number = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const record = value => value && typeof value === 'object' && !Array.isArray(value);
const unique = values => [...new Set(values)];
const copy = value => JSON.parse(JSON.stringify(value));
const safeString = (value, limit = 300) => typeof value === 'string' ? value.slice(0, limit) : '';
const failed = (state, message) => ({state, ok: false, message, reactions: []});
const round = (patron, stage) => patron?.rounds?.[STAGES[stage]];
const groupRounds = id => ['opener', 'story'].map(stage => GROUP_LINES[id]?.[stage]).filter(Boolean);
const groupRound = (state, id) => groupRounds(id)[state.groups[id]?.usedLines.length || 0];

function validContacts(value) {
  if (!Array.isArray(value)) return [];
  const result = [];
  for (const item of value.slice(0, 64)) {
    const patron = patronById.get(item?.patronId);
    if (!patron || !['contact', 'date'].includes(item?.kind) || result.some(contact => contact.patronId === patron.id)) continue;
    result.push({patronId: patron.id, name: patron.name, kind: item.kind, night: clamp(Math.floor(number(item.night, 1)), 1, 999999)});
  }
  return result;
}

/** Start a new fictional evening. Household saves are never read or written. */
export function createNight(previous) {
  return {
    version: 1,
    night: previous ? clamp(Math.floor(number(previous.night, 0)) + 1, 1, 999999) : 1,
    budget: STARTING_BUDGET,
    spent: 0,
    ended: false,
    contacts: validContacts(previous?.contacts),
    patrons: Object.fromEntries(PATRONS.map(patron => [patron.id, {stage: 0, rapport: 0, chemistry: 0, history: [], invited: false, outcome: null, recovered: false}])),
    groups: Object.fromEntries(GROUPS.map(group => [group.id, {usedLines: [], history: []}])),
    purchases: [],
    offers: [],
    eventsPlayed: [],
    log: [],
    laughs: 0,
    eventCount: 0,
  };
}

/** Restore known fields only; a malformed or future-version save starts a clean night. */
export function loadNight(raw) {
  try {
    if (typeof raw === 'string') {
      if (raw.length > 160000) return createNight();
      raw = JSON.parse(raw);
    }
    if (!record(raw) || raw.version !== 1 || !record(raw.patrons) || !record(raw.groups)) return createNight();
    if (!Number.isInteger(raw.budget) || raw.budget < 0 || raw.budget > STARTING_BUDGET) return createNight();
    if (!Number.isInteger(raw.spent) || raw.spent < 0 || raw.spent + raw.budget !== STARTING_BUDGET) return createNight();
    if (!Number.isInteger(raw.night) || raw.night < 1) return createNight();
    const state = createNight();
    state.night = Math.min(raw.night, 999999);
    state.budget = raw.budget;
    state.spent = raw.spent;
    state.ended = raw.ended === true;
    state.contacts = validContacts(raw.contacts);
    state.laughs = clamp(Math.floor(number(raw.laughs)), 0, 1000);
    state.eventCount = clamp(Math.floor(number(raw.eventCount)), 0, 1000000);
    for (const patron of PATRONS) {
      const saved = raw.patrons[patron.id];
      if (!record(saved)) continue;
      const progress = state.patrons[patron.id];
      const savedHistory = Array.isArray(saved.history) ? saved.history.slice(0, 4) : [];
      // History, not an independent counter, determines the next playable stage.
      // Rebuild lines from the catalog so a partial save cannot skip a round or
      // restore a player invitation as though it were the NPC's response.
      for (const item of savedHistory) {
        if (!record(item)) break;
        if (item.lineId === 'recover') {
          if (progress.recovered || progress.history.at(-1)?.tone !== 'miss') break;
          progress.recovered = true;
          progress.history.push({lineId: 'recover', text: patron.recovery || 'That sounded better in my head.', reaction: patron.recoveryReply || 'Thanks. We can laugh about that now.', tone: 'good'});
          continue;
        }
        const line = round(patron, progress.stage)?.choices.find(choice => choice.id === item.lineId);
        if (!line) break;
        const reaction = react(patron, line, clamp(number(line.score, scoreStyle(patron, line.style)), -1, 2));
        progress.history.push({lineId: line.id, text: line.text, reaction: reaction.text, tone: reaction.tone});
        progress.stage += 1;
      }
      progress.rapport = clamp(Math.floor(number(saved.rapport)), -5, 15);
      progress.chemistry = clamp(Math.floor(number(saved.chemistry)), 0, 15);
      progress.invited = saved.invited === true;
      progress.outcome = ['contact', 'date', 'friends', 'declined'].includes(saved.outcome) ? saved.outcome : null;
      if (progress.outcome) progress.invited = true;
      progress.recovered ||= saved.recovered === true;
      if (['contact', 'date'].includes(progress.outcome)) {
        const contact = state.contacts.find(item => item.patronId === patron.id);
        if (!contact) state.contacts.push({patronId: patron.id, name: patron.name, kind: progress.outcome, night: state.night});
        else if (progress.outcome === 'date') contact.kind = 'date';
      }
    }
    for (const group of GROUPS) {
      const saved = raw.groups[group.id];
      if (!record(saved)) continue;
      const savedIds = Array.isArray(saved.usedLines) ? saved.usedLines.slice(0, 2) : [];
      for (const id of savedIds) {
        const line = groupRound(state, group.id)?.choices.find(choice => choice.id === id);
        if (!line) break;
        state.groups[group.id].usedLines.push(line.id);
        state.groups[group.id].history.push({lineId: line.id, text: line.text, reaction: line.response || ''});
      }
    }
    const recipients = new Set(['self', ...patronById.keys()]);
    state.purchases = (Array.isArray(raw.purchases) ? raw.purchases : []).slice(0, 80).filter(item => record(item) && drinkById.has(item.drinkId) && Array.isArray(item.recipientIds)).map(item => {
      const recipientIds = unique(item.recipientIds.slice(0, PATRONS.length + 1).filter(id => recipients.has(id)));
      return {drinkId: item.drinkId, recipientIds, cost: recipientIds.length * drinkById.get(item.drinkId).price};
    }).filter(item => item.recipientIds.length);
    if (state.purchases.reduce((sum, purchase) => sum + purchase.cost, 0) !== state.spent) return createNight();
    const purchasedGifts = new Map();
    for (const purchase of state.purchases) {
      for (const patronId of purchase.recipientIds.filter(id => id !== 'self')) {
        if (purchasedGifts.has(patronId) || !patronById.get(patronId).drinks.includes(purchase.drinkId)) return createNight();
        purchasedGifts.set(patronId, purchase.drinkId);
      }
    }
    const seenOffers = new Set();
    state.offers = (Array.isArray(raw.offers) ? raw.offers : []).slice(0, PATRONS.length * 2).filter(item => {
      if (!record(item) || !patronById.has(item.patronId) || !drinkById.has(item.drinkId) || seenOffers.has(item.patronId)) return false;
      seenOffers.add(item.patronId);
      return true;
    }).map(item => ({patronId: item.patronId, drinkId: purchasedGifts.get(item.patronId) || item.drinkId, accepted: purchasedGifts.has(item.patronId)}));
    // A missing offer row must not make an already purchased gift repeatable.
    for (const [patronId, drinkId] of purchasedGifts) {
      if (!seenOffers.has(patronId)) state.offers.push({patronId, drinkId, accepted: true});
    }
    state.eventsPlayed = unique((Array.isArray(raw.eventsPlayed) ? raw.eventsPlayed.slice(0, EVENTS.length * 2) : []).filter(id => eventById.has(id)));
    state.log = (Array.isArray(raw.log) ? raw.log.slice(-40) : []).filter(record).map(item => ({id: safeString(item.id, 80), kind: safeString(item.kind, 40), message: safeString(item.message, 500)}));
    return state;
  } catch {
    return createNight();
  }
}

function addLog(state, kind, message) {
  state.eventCount += 1;
  state.log.push({id: `night-${state.night}-${state.eventCount}`, kind, message});
  state.log = state.log.slice(-40);
}

function scoreStyle(patron, style) {
  if (patron.likes?.includes(style)) return 2;
  if (patron.dislikes?.includes(style)) return -1;
  return style === 'sincere' ? 1 : 0;
}

function react(patron, line, score) {
  const tone = score >= 2 ? 'great' : score === 1 ? 'good' : score === 0 ? 'neutral' : 'miss';
  return {patronId: patron.id, tone, text: line?.response || patron.reactions?.[tone === 'neutral' ? 'good' : tone] || (score > 0 ? 'Okay, that got me.' : score === 0 ? 'I see what you were going for.' : 'That one needed a little more rehearsal.')};
}

function award(progress, score, group = false) {
  const rapport = score >= 2 ? 3 : score === 1 ? 2 : score === 0 ? 1 : -1;
  progress.rapport = clamp(progress.rapport + (group ? Math.sign(rapport) : rapport), -5, 15);
  progress.chemistry = clamp(progress.chemistry + (group ? (score >= 2 ? 1 : 0) : score), 0, 15);
}

function success(state, message, reactions = [], event) {
  return {state, ok: true, message, reactions, ...(event ? {event} : {})};
}

function talk(state, action) {
  const patron = patronById.get(action.patronId);
  if (!patron) return failed(state, 'Choose someone who is here tonight.');
  const progress = state.patrons[patron.id];
  if (progress.invited) return failed(state, 'This conversation has its ending. Give someone else a hello.');
  const choices = round(patron, progress.stage)?.choices || [];
  const line = choices.find(choice => choice.id === action.lineId);
  if (!line) return failed(state, 'That line belongs to a different moment in the conversation.');
  if (progress.history.some(item => item.lineId === line.id)) return failed(state, 'They have already heard that one.');
  const next = copy(state);
  const updated = next.patrons[patron.id];
  const score = clamp(number(line.score, scoreStyle(patron, line.style)), -1, 2);
  const reaction = react(patron, line, score);
  award(updated, score);
  updated.stage += 1;
  updated.history.push({lineId: line.id, text: line.text, reaction: reaction.text, tone: reaction.tone});
  if (score >= 2) next.laughs += 1;
  const message = `${patron.name}: ${reaction.text}`;
  addLog(next, 'conversation', message);
  return success(next, message, [reaction]);
}

function recover(state, action) {
  const patron = patronById.get(action.patronId);
  if (!patron) return failed(state, 'Choose someone who is here tonight.');
  const view = getPatronView(state, patron.id);
  if (!view.canRecover) return failed(state, 'There is nothing to recover from right now.');
  const next = copy(state);
  const progress = next.patrons[patron.id];
  progress.recovered = true;
  progress.rapport = clamp(progress.rapport + 1, -5, 15);
  const reaction = {patronId: patron.id, tone: 'good', text: patron.recoveryReply || 'Thanks. We can laugh about that now.'};
  progress.history.push({lineId: 'recover', text: patron.recovery || 'That sounded better in my head.', reaction: reaction.text, tone: 'good'});
  addLog(next, 'recovery', `${patron.name}: ${reaction.text}`);
  return success(next, reaction.text, [reaction]);
}

function groupTalk(state, action) {
  const group = groupById.get(action.groupId);
  if (!group) return failed(state, 'Choose a group in the room.');
  const line = groupRound(state, group.id)?.choices?.find(choice => choice.id === action.lineId);
  if (!line) return failed(state, 'Choose one of this group’s conversation starters.');
  const progress = state.groups[group.id];
  if (progress.usedLines.includes(line.id)) return failed(state, 'The group has already heard that one.');
  if (progress.usedLines.length >= groupRounds(group.id).length) return failed(state, 'You have worked this table. Try a one-to-one conversation.');
  const next = copy(state);
  const reactions = group.memberIds.map(id => {
    const patron = patronById.get(id);
    const authored = line.reactions?.[id];
    const score = clamp(number(authored?.score, scoreStyle(patron, line.style)), -1, 2);
    const reaction = react(patron, authored ? {response: authored.response} : null, score);
    // A settled invitation remains settled; group jokes cannot reopen a rejection.
    if (!next.patrons[id].invited) award(next.patrons[id], score, true);
    if (score >= 2) next.laughs += 1;
    return reaction;
  });
  next.groups[group.id].usedLines.push(line.id);
  const message = line.response || reactions.map(reaction => `${patronById.get(reaction.patronId).name}: ${reaction.text}`).join(' ');
  next.groups[group.id].history.push({lineId: line.id, text: line.text, reaction: message});
  addLog(next, 'group', `${group.name}: ${message}`);
  return success(next, message, reactions);
}

function buy(state, action) {
  const drink = drinkById.get(action.drinkId);
  if (!drink) return failed(state, 'Choose a drink from the menu.');
  const target = action.target || 'self';
  let recipientIds;
  if (target === 'self') recipientIds = ['self'];
  else if (patronById.has(target)) recipientIds = [target];
  else if (groupById.has(target)) recipientIds = groupById.get(target).memberIds;
  else return failed(state, 'Choose yourself, a guest, or a table for this order.');
  if (state.purchases.length >= 80) return failed(state, 'The bartender calls time on orders for this evening.');
  const eligible = recipientIds.filter(id => id === 'self' || !state.offers.some(offer => offer.patronId === id));
  if (!eligible.length) return failed(state, 'You have already offered this company a drink tonight.');
  const accepted = eligible.filter(id => id === 'self' || patronById.get(id).drinks?.includes(drink.id));
  const cost = accepted.length * drink.price;
  if (cost > state.budget) return failed(state, `That order costs $${cost}; you have $${state.budget}. Try a smaller order or a different drink.`);
  const next = copy(state);
  const reactions = [];
  for (const id of eligible) {
    if (id === 'self') continue;
    const patron = patronById.get(id);
    const takesDrink = accepted.includes(id);
    next.offers.push({patronId: id, drinkId: drink.id, accepted: takesDrink});
    reactions.push({patronId: id, tone: takesDrink ? 'good' : 'neutral', text: takesDrink ? patron.drinkReply || `Thanks! ${drink.name} is my kind of order.` : patron.drinkDecline || `I’ll pass on the ${drink.name.toLowerCase()}, thanks. Happy to chat, though.`});
  }
  if (accepted.length) {
    next.purchases.push({drinkId: drink.id, recipientIds: accepted, cost});
    next.budget -= cost;
    next.spent += cost;
  }
  // A drink is a purchase, not a romantic-progress transaction.
  const names = accepted.map(id => id === 'self' ? 'you' : patronById.get(id).name);
  const declined = eligible.length - accepted.length;
  const message = accepted.length ? `${drink.name} for ${names.join(' and ')}. ${cost ? `$${cost} paid.` : 'On the house.'}${declined ? ` ${declined} declined; you were not charged for them.` : ''}` : 'They politely passed. You were not charged.';
  addLog(next, 'drinks', message);
  return success(next, message, reactions);
}

function invite(state, action) {
  const patron = patronById.get(action.patronId);
  if (!patron) return failed(state, 'Choose someone who is here tonight.');
  const progress = state.patrons[patron.id];
  if (progress.invited) return failed(state, 'They have already answered. Leave the conversation on that note.');
  if (progress.stage < 2) return failed(state, 'Share a couple of conversation turns before asking.');
  const kind = action.kind || 'contact';
  if (!['contact', 'date'].includes(kind)) return failed(state, 'Choose a contact swap or a date invitation.');
  const next = copy(state);
  const updated = next.patrons[patron.id];
  updated.invited = true;
  const neededChemistry = kind === 'date' ? 5 : 4;
  const neededRapport = kind === 'date' ? 4 : 3;
  const accepted = progress.chemistry >= neededChemistry && progress.rapport >= neededRapport;
  let text;
  if (accepted) {
    updated.outcome = kind;
    const oldContact = next.contacts.find(contact => contact.patronId === patron.id);
    if (oldContact) {
      if (kind === 'date') oldContact.kind = kind;
    } else next.contacts.push({patronId: patron.id, name: patron.name, kind, night: next.night});
    text = kind === 'date' ? patron.date || `Yes. ${patron.dateTitle || 'Let’s do this again sometime.'}` : patron.contact || 'Yes! Let’s exchange numbers.';
  } else if (progress.rapport >= 3) {
    updated.outcome = 'friends';
    text = patron.friend || 'I’m enjoying the conversation. For me this is a friend vibe.';
  } else {
    updated.outcome = 'declined';
    text = patron.decline || 'Thanks for asking, but I’m going to pass. Enjoy the rest of your night.';
  }
  const reaction = {patronId: patron.id, tone: accepted ? 'great' : 'neutral', text};
  const message = `${patron.name}: ${text}`;
  addLog(next, accepted ? kind : 'goodbye', message);
  return success(next, message, [reaction], accepted ? 'connection' : 'conversation-ended');
}

function eventAction(state, action) {
  const event = eventById.get(action.eventId);
  const choice = event?.choices?.find(item => item.id === action.choiceId);
  if (!event || !choice) return failed(state, 'That moment has passed.');
  if (state.eventsPlayed.includes(event.id)) return failed(state, 'You already played that moment.');
  const next = copy(state);
  next.eventsPlayed.push(event.id);
  const message = choice.response || event.text;
  addLog(next, 'bar-event', message);
  return success(next, message, [], event.id);
}

/** Actions are immutable. Invalid actions return the original state unchanged. */
export function applyAction(state, action) {
  if (!record(state) || state.version !== 1 || !record(state.patrons) || !record(action)) return failed(state, 'The evening could not be updated. Start a new night.');
  if (action.type === 'new-night') return success(createNight(state), 'A fresh night, a fresh $60, and familiar faces.');
  if (state.ended) return failed(state, 'Last call is over. Start a new night to play again.');
  switch (action.type) {
    case 'talk': return talk(state, action);
    case 'recover': return recover(state, action);
    case 'group-talk': return groupTalk(state, action);
    case 'buy': return buy(state, action);
    case 'invite': return invite(state, action);
    case 'event': return eventAction(state, action);
    case 'end-night': {
      const next = copy(state);
      next.ended = true;
      addLog(next, 'last-call', 'Last call. Your best stories and new connections are saved.');
      return success(next, 'Last call. See how your night turned out.', [], 'last-call');
    }
    default: return failed(state, 'That action is not on tonight’s menu.');
  }
}

export function getPatronView(state, id) {
  const patron = patronById.get(id);
  if (!patron) return null;
  const progress = state.patrons[id];
  const currentRound = round(patron, progress.stage);
  const last = progress.history.at(-1);
  const status = progress.outcome === 'date' ? 'A date is on the cards' : progress.outcome === 'contact' ? 'Numbers exchanged' : progress.outcome === 'friends' ? 'Friend energy' : progress.outcome === 'declined' ? 'A gracious goodbye' : progress.invited ? 'Conversation complete' : progress.chemistry >= 4 ? 'There’s a spark' : progress.rapport >= 3 ? 'Warming up' : progress.stage ? 'Finding your rhythm' : 'Say hello';
  const ending = progress.outcome === 'date' ? patron.date : progress.outcome === 'contact' ? patron.contact : progress.outcome === 'friends' ? patron.friend : progress.outcome === 'declined' ? patron.decline : null;
  return {
    patron,
    stage: STAGES[progress.stage] || 'invite',
    stageIndex: progress.stage,
    prompt: ending || (progress.invited ? 'Enjoy the rest of your evening.' : currentRound?.prompt || 'So, what happens next?'),
    options: state.ended || progress.invited ? [] : currentRound?.choices || [],
    rapport: progress.rapport,
    chemistry: progress.chemistry,
    status,
    canAsk: !state.ended && !progress.invited && progress.stage >= 2,
    canRecover: !state.ended && !progress.invited && !progress.recovered && last?.tone === 'miss',
    history: progress.history,
    contactStatus: progress.outcome,
    offered: state.offers.some(offer => offer.patronId === id),
    contactSaved: state.contacts.some(contact => contact.patronId === id),
  };
}


export function getGroupView(state, id) {
  const group = groupById.get(id);
  if (!group) return null;
  const progress = state.groups[id];
  const current = groupRound(state, id);
  return {group, stage: progress.usedLines.length, prompt: current?.prompt || 'Good company. What happens next?', options: state.ended ? [] : current?.choices || [], history: progress.history, done: !current};
}

export function getSummary(state) {
  const newConnections = Object.entries(state.patrons).filter(([, progress]) => ['contact', 'date'].includes(progress.outcome)).map(([id, progress]) => ({patronId: id, name: patronById.get(id).name, kind: progress.outcome, dateTitle: patronById.get(id).dateTitle}));
  return {
    night: state.night,
    budget: state.budget,
    spent: state.spent,
    drinksBought: state.purchases.reduce((total, purchase) => total + purchase.recipientIds.length, 0),
    laughs: state.laughs,
    connections: newConnections,
    contacts: state.contacts,
    bestMoment: [...state.log].reverse().find(item => ['date', 'contact', 'group', 'conversation'].includes(item.kind))?.message || 'You made it out of the house. That counts.',
    ended: state.ended,
  };
}

/** Return only to this app’s household route. Never turn query input into an external redirect. */
export function safeReturnTo(value) {
  if (typeof value !== 'string' || value.length > 2000 || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(value)) return '/world/house';
  try {
    const url = new URL(value, 'https://happybearlandia.invalid');
    if (url.origin !== 'https://happybearlandia.invalid' || !/^\/world\/house(?:\/[A-Za-z0-9_-]{1,80})?\/?$/.test(url.pathname)) return '/world/house';
    return `${url.pathname}${url.search}`;
  } catch {
    return '/world/house';
  }
}
