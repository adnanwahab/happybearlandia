import { PATRONS, DRINKS, GROUPS, GROUP_LINES, EVENTS } from './content.js';
import { BAR_SAVE_KEY, createNight, loadNight, applyAction, getPatronView, getGroupView, getSummary, safeReturnTo } from './model.js';
import { createLoungeAudio } from './audio.js';

const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const patronById = id => PATRONS.find(person => person.id === id);
const groupById = id => GROUPS.find(group => group.id === id);
const color = person => /^#[0-9a-f]{6}$/i.test(person?.color) ? person.color : '#d7b78d';
const audio = createLoungeAudio();
const panel = $('#panel-content'), dialog = $('#bar-dialog');
const returnTo = safeReturnTo(new URLSearchParams(location.search).get('returnTo'));
$('#return-home').href = returnTo;
let state, scene, soundOn = false, toastTimer, saveProblem = false;
let selection = { type: 'welcome' }, orderTarget = 'self', lastResult = null, lastContext = null;
try { state = loadNight(localStorage.getItem(BAR_SAVE_KEY)); } catch { state = createNight(); saveProblem = true; }

// Portraits are small vector UI illustrations; the scene uses independent 3D meshes.
function portrait(person, extraClass = '') {
  const index = Math.max(0, PATRONS.findIndex(item => item.id === person?.id));
  const skin = ['#c28a63','#e6b58c','#966044','#d79b77','#6e4939','#cda288'][index];
  const hair = ['#302521','#4c3028','#211f2c','#9e653b','#171a22','#3c2729'][index];
  const longHair = person?.gender === 'woman';
  return `<span class="portrait ${extraClass}" aria-hidden="true"><svg viewBox="0 0 64 64"><rect width="64" height="64" fill="${color(person)}" opacity=".22"/><circle cx="32" cy="34" r="30" fill="${color(person)}" opacity=".08"/>${longHair ? `<path d="M15 28C13 2 51 2 49 29L52 51H12Z" fill="${hair}"/>` : ''}<path d="M8 65V56Q12 44 26 45H38Q53 44 56 56V65Z" fill="${color(person)}"/><path d="M27 36H37V48Q32 53 27 48Z" fill="${skin}"/><ellipse cx="32" cy="28" rx="13" ry="17" fill="${skin}"/><path d="M19 25Q14 8 30 8Q49 8 45 26L39 17Q29 24 19 25Z" fill="${hair}"/><circle cx="27" cy="28" r="1.25" fill="#242324"/><circle cx="37" cy="28" r="1.25" fill="#242324"/><path d="M28 35Q32 39 37 34" stroke="#5a3430" stroke-width="1.4" fill="none" stroke-linecap="round"/>${person?.id === 'owen' ? '<path d="M21 26H30V32H21ZM34 26H43V32H34ZM30 28H34" fill="none" stroke="#303036" stroke-width="1.2"/>' : ''}${person?.id === 'ivy' ? '<circle cx="19" cy="16" r="5" fill="#f5cf8a"/><circle cx="19" cy="16" r="2" fill="#9a6a45"/>' : ''}</svg></span>`;
}
function save() {
  try { localStorage.setItem(BAR_SAVE_KEY, JSON.stringify(state)); saveProblem = false; }
  catch { saveProblem = true; }
  $('#save-message').hidden = !saveProblem;
  $('#save-message').textContent = 'Your browser could not save this night. You can keep playing, but progress may be lost when you close the page.';
}
function announce(message) {
  $('#announcer').textContent = message;
  const toast = $('#scene-toast'); toast.textContent = message; toast.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.hidden = true; }, 4500);
}
function updateRoom() {
  const summary = getSummary(state);
  $('#budget').textContent = `$${state.budget}`;
  $('#contact-count').textContent = state.contacts.length;
  $('#night-number').textContent = `/ ${String(state.night).padStart(2, '0')}`;
  const met = PATRONS.filter(person => state.patrons[person.id].history.length || state.groups[person.groupId]?.usedLines.length).length;
  $('#night-stats').textContent = `${met} / 6 people met · ${summary.laughs} ${summary.laughs === 1 ? 'laugh' : 'laughs'} · ${summary.drinksBought} ${summary.drinksBought === 1 ? 'drink' : 'drinks'}`;
  $('#end-night').textContent = state.ended ? 'See tonight’s story ↗' : 'Call it a night ↗';
  $('#open-menu').disabled = state.ended;
  $('#guest-roster').innerHTML = PATRONS.map(person => {
    const view = getPatronView(state, person.id);
    return `<button type="button" class="guest-card" data-person="${person.id}" aria-pressed="${selection.type === 'person' && selection.id === person.id}" aria-label="Talk to ${escape(person.name)}, ${person.age}, ${escape(person.role)}">${portrait(person)}<strong>${escape(person.name)} <span class="sr-only">age ${person.age}</span></strong><small>${person.age} · ${escape(person.role)}</small>${view.contactSaved ? '<span class="connected" aria-label="Connection saved">♡</span>' : ''}</button>`;
  }).join('');
  $('#group-roster').innerHTML = GROUPS.map(group => `<button type="button" class="group-card" data-group="${group.id}" aria-pressed="${selection.type === 'group' && selection.id === group.id}" aria-label="Join ${escape(group.name)}"><span class="group-icon">${group.memberIds.map(id => portrait(patronById(id))).join('')}</span><span><strong>${escape(group.name)}</strong><small>${escape(group.subtitle)}</small></span><span class="group-arrow" aria-hidden="true">↗</span></button>`).join('');
  scene?.setMood(state.ended ? 'closed' : 'open');
}
function panelTop(label, status = 'MAKE YOURSELF AT HOME') {
  return `<div class="panel-topline"><span>${escape(label)}</span><span class="panel-status">${escape(status)}</span></div>`;
}
function showWelcome() {
  return `${panelTop('YOUR NIGHT STARTS HERE')}<div class="panel-body"><div class="welcome-mark" aria-hidden="true"><svg viewBox="0 0 120 100" fill="none"><circle cx="60" cy="49" r="43" stroke="#c5a777" opacity=".35"/><path d="M25 24H57L43 47V68M34 69H52M63 30H94L80 53V75M71 76H89" stroke="#ebc285" stroke-width="2" stroke-linecap="round"/><path d="M30 33H52M68 39H90" stroke="#c5a777"/><path d="M57 11L60 18M69 13L65 19M75 23L68 24" stroke="#e7a3ba" stroke-linecap="round"/><circle cx="43" cy="31" r="3" fill="#b5d7b1"/></svg></div><div class="panel-eyebrow">PULL UP A CHAIR</div><h2 class="welcome-title">A little charm.<br>A lot of possibility.</h2><p class="welcome-copy">Six people, six different senses of humor. Find someone interesting, read the room, and see if your weird matches theirs.</p><div class="welcome-step"><span class="step-number">01</span><div><strong>Find your kind of funny</strong><p>Read a guest’s tell. A terrible pun can be someone else’s perfect opener.</p></div></div><div class="welcome-step"><span class="step-number">02</span><div><strong>Make a night of it</strong><p>Order something, offer a drink, or join a table’s wildly unimportant debate.</p></div></div><div class="welcome-step"><span class="step-number">03</span><div><strong>See if there’s a spark</strong><p>Trade numbers, suggest a date, or leave with an excellent story.</p></div></div><button type="button" class="primary-button full-button welcome-bottom" data-person="nova">Say hello to Nova <span aria-hidden="true">↗</span></button><p class="tiny-note">Click a guest in the room or choose a name below it. There’s no timer.</p></div><p class="panel-footnote">Jules, the bartender: “Your opening line can be bad. Your company shouldn’t be.”</p>`;
}
const toneLabel = { great: 'That landed.', good: 'They’re warming up.', neutral: 'A thoughtful pause.', miss: 'A spectacular little misfire.' };
function resultCard(view) {
  const last = view.history.at(-1);
  const response = lastContext === view.patron.id && lastResult?.reactions?.find(item => item.patronId === view.patron.id);
  if (!last && !response) return '';
  const outcomeText = ({date: view.patron.date, contact: view.patron.contact, friends: view.patron.friend, declined: view.patron.decline})[view.contactStatus];
  const reaction = outcomeText || response?.text || last?.reaction, tone = view.contactStatus ? (['date','contact'].includes(view.contactStatus) ? 'great' : 'neutral') : response?.tone || last?.tone;
  return `<div class="result-card ${tone === 'miss' ? 'miss' : ''}">${last && !view.contactStatus ? `<p class="player-quote">You: “${escape(last.text)}”</p>` : ''}<strong>${escape(view.contactStatus ? view.status : toneLabel[tone] || 'A moment between you.')}</strong><p>${escape(view.patron.name)}: “${escape(reaction)}”</p></div>`;
}
function meter(label, value, max) {
  const width = Math.max(0, Math.min(100, value / max * 100));
  const description = value >= 5 ? 'Strong' : value >= 3 ? 'Building' : value > 0 ? 'A little' : 'Just meeting';
  return `<div class="connection-meter"><label>${label}</label><span>${description}</span><div class="meter-track" role="meter" aria-label="${label}" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${Math.max(0, Math.min(max, value))}"><span style="width:${width}%"></span></div></div>`;
}
function choicesHtml(options, type, id) {
  return `<div class="choices">${options.map((choice, index) => `<button type="button" class="choice" data-action="${type}" data-id="${id}" data-line="${choice.id}"><span class="choice-number">${index + 1}</span><span class="choice-text">${escape(choice.text)}<span class="choice-style">${escape(choice.label || choice.style)}</span></span><span class="choice-arrow" aria-hidden="true">↗</span></button>`).join('')}</div>`;
}
function pendingEvent() {
  if (state.ended || state.log.filter(item => ['conversation', 'group'].includes(item.kind)).length < 3) return '';
  const event = EVENTS.find(item => !state.eventsPlayed.includes(item.id));
  if (!event) return '';
  return `<div class="event-card"><strong>MEANWHILE, AT THE BAR…</strong><p>${escape(event.title)}</p><button type="button" class="text-button" data-open-event="${event.id}">Get involved ↗</button></div>`;
}
function showPerson(id) {
  const view = getPatronView(state, id), p = view.patron;
  const inviteButtons = view.canAsk ? `<div class="personal-actions"><button type="button" class="secondary-button" data-invite="contact" data-id="${id}">Swap numbers ♡</button><button type="button" class="primary-button" data-invite="date" data-id="${id}">Ask on a date ↗</button></div>` : '';
  return `${panelTop('ONE GOOD CONVERSATION', view.contactStatus ? 'A MOMENT TO REMEMBER' : `TURN ${Math.min(view.stageIndex + 1, 3)} / 3`)}<div class="panel-body"><div class="person-heading">${portrait(p)}<div><h2 id="conversation-name">${escape(p.name)} <span style="font:12px system-ui;color:#aab5b5">${p.age}</span></h2><small>${escape(p.role)} · ${escape(groupById(p.groupId)?.name)}</small></div><button type="button" class="close-button" data-welcome aria-label="Leave conversation">×</button></div><p class="bio">${escape(p.bio)}</p><div class="taste-hint"><span>READ THE ROOM</span>${escape(p.clue)}</div><div class="connection-meters">${meter('Connection', view.rapport, 9)}${meter('Chemistry', view.chemistry, 6)}</div>${resultCard(view)}${view.contactStatus ? `<span class="outcome-badge">${escape(view.status)}</span><p class="completed-note">${view.contactStatus === 'date' ? `On the calendar: <strong>${escape(p.dateTitle)}</strong>. Find the plan in your connections.` : view.contactStatus === 'contact' ? `${escape(p.name)} is in your connections. A good opening chapter.` : 'A good conversation can have more than one kind of ending. There’s plenty of company in the room.'}</p><button type="button" class="secondary-button full-button" data-welcome>Back to the room ↗</button>` : `${view.options.length ? `<div class="bubble"><span class="bubble-speaker">${escape(p.name.toUpperCase())}</span>“${escape(view.prompt)}”</div><div class="choices-label"><span>WHAT DO YOU SAY?</span><span class="key-tip">KEYS 1–4</span></div>${choicesHtml(view.options, 'talk', id)}` : `<p class="completed-note">The conversation has found its rhythm. Want to see where it goes?</p>`}${view.canRecover ? `<div class="personal-actions"><button type="button" class="secondary-button full-button" data-recover="${id}">Recover: ${escape(p.recovery || 'That sounded better in my head.')}</button></div>` : ''}${inviteButtons}<div class="personal-actions"><button type="button" class="secondary-button" data-offer="${id}" ${view.offered ? 'disabled' : ''}>${view.offered ? 'Drink offer made ✓' : 'Offer a drink ♧'}</button><button type="button" class="secondary-button" data-group="${p.groupId}">Join their table ↗</button></div>`}${pendingEvent()}</div><p class="panel-footnote">${view.stageIndex < 2 ? 'A good question counts, too. You don’t have to perform every second.' : 'An invitation is a question. They’ll tell you how they feel.'}</p>`;
}
function showGroup(id) {
  const view = getGroupView(state, id), group = view.group;
  const latest = view.history.at(-1);
  const lastLine = latest && Object.values(GROUP_LINES[id]).flatMap(round => round.choices).find(line => line.id === latest.lineId);
  const reactions = lastLine ? group.memberIds.map(patronId => { const reaction = lastLine.reactions[patronId]; return {patronId, text:reaction.response, tone:reaction.score >= 2 ? 'great' : reaction.score === 1 ? 'good' : reaction.score === 0 ? 'neutral' : 'miss'}; }) : null;
  const offeredEveryone = group.memberIds.every(personId => state.offers.some(offer => offer.patronId === personId));
  return `${panelTop('YOU’RE AT THE TABLE', 'GROUP CONVERSATION')}<div class="panel-body"><div style="display:flex;justify-content:space-between;gap:10px"><h2 class="group-title">${escape(group.name)}</h2><button type="button" class="close-button" data-welcome aria-label="Leave group">×</button></div><p class="bio">${escape(group.topic || group.subtitle)}</p><div class="group-members">${group.memberIds.map(personId => { const p = patronById(personId); return `<button type="button" class="member-chip" data-person="${personId}" aria-label="Talk privately to ${escape(p.name)}">${portrait(p)}${escape(p.name)} ↗</button>`; }).join('')}</div><div class="taste-hint"><span>THE TABLE’S ENERGY</span>${escape(group.clue)}</div>${latest ? `<div class="result-card"><p class="player-quote">You: “${escape(latest.text)}”</p>${reactions?.length ? reactions.map(reaction => `<div class="group-reaction">${portrait(patronById(reaction.patronId))}<p><strong>${escape(patronById(reaction.patronId).name)} · ${escape(toneLabel[reaction.tone] || 'Listening')}</strong>${escape(reaction.text)}</p></div>`).join('') : `<p>${escape(latest.reaction)}</p>`}</div>` : ''}${view.options.length ? `<div class="bubble"><span class="bubble-speaker">AT THE TABLE · ROUND ${view.stage + 1}</span>“${escape(view.prompt)}”</div><div class="choices-label"><span>JUMP INTO THE CONVERSATION</span><span class="key-tip">KEYS 1–4</span></div>${choicesHtml(view.options, 'group-talk', id)}` : '<p class="completed-note">You’re part of the story now. Pull someone aside for a one-to-one chat, or check out another table.</p>'}<div class="personal-actions"><button type="button" class="secondary-button full-button" data-offer="${id}" ${offeredEveryone ? 'disabled' : ''}>${offeredEveryone ? 'Round offered ✓' : 'Offer this table a round ♧'}</button></div>${view.done ? `<div class="personal-actions">${group.memberIds.map(personId => `<button type="button" class="secondary-button" data-person="${personId}">Talk to ${escape(patronById(personId).name)} ↗</button>`).join('')}</div>` : ''}${pendingEvent()}</div><p class="panel-footnote">Same joke, different reactions. Listen to the people, not just the loudest laugh.</p>`;
}
function recipientOptions() {
  return `<option value="self" ${orderTarget === 'self' ? 'selected' : ''}>A drink for me</option><optgroup label="Offer someone a drink">${PATRONS.map(p => `<option value="${p.id}" ${orderTarget === p.id ? 'selected' : ''}>${escape(p.name)} · ${p.age}</option>`).join('')}</optgroup><optgroup label="Offer a table a round">${GROUPS.map(g => `<option value="${g.id}" ${orderTarget === g.id ? 'selected' : ''}>${escape(g.name)} · ${g.memberIds.length} people</option>`).join('')}</optgroup>`;
}
function showMenu() {
  const target = patronById(orderTarget), group = groupById(orderTarget);
  const targetIds = target ? [target.id] : group?.memberIds || [];
  const alreadyOffered = targetIds.length > 0 && targetIds.every(id => state.offers.some(offer => offer.patronId === id));
  const prefs = targetIds.length ? `<div class="taste-hint"><span>THEIR USUAL ORDERS</span>${targetIds.map(id => { const p = patronById(id); return `${escape(p.name)}: ${p.drinks.map(drinkId => escape(DRINKS.find(d => d.id === drinkId)?.name)).join(', ')}.`; }).join('<br>')}</div>` : '';
  return `${panelTop('JULES IS BEHIND THE BAR', 'WHAT ARE WE HAVING?')}<div class="panel-body"><div style="display:flex;justify-content:space-between;gap:10px"><h2 class="group-title">Something good.</h2><button type="button" class="close-button" data-welcome aria-label="Close drinks menu">×</button></div><p class="bio">“I make excellent drinks and extremely average life decisions.” — Jules</p><div class="drink-recipient"><label for="drink-recipient">Who’s this for?</label><select id="drink-recipient">${recipientOptions()}</select></div>${prefs}${alreadyOffered ? '<p class="menu-receipt">You’ve already offered this company a drink tonight. There’s still plenty to talk about.</p>' : ''}<div class="drink-list">${DRINKS.map(drink => {
    const acceptedIds = orderTarget === 'self' ? ['self'] : targetIds.filter(id => !state.offers.some(o => o.patronId === id) && patronById(id).drinks.includes(drink.id));
    const cost = drink.price * acceptedIds.length;
    return `<article class="drink-item"><span class="drink-glyph" aria-hidden="true">${drink.alcoholic ? '♧' : '♢'}</span><div><h3>${escape(drink.name)}</h3><p>${escape(drink.description)}</p><div class="drink-price">${drink.price ? `$${drink.price}` : 'Free'} · ${drink.alcoholic ? 'With alcohol' : 'Alcohol-free'}${group ? ` · $${cost} if accepted` : ''}</div></div><button type="button" class="drink-buy" data-drink="${drink.id}" aria-label="${orderTarget === 'self' ? 'Buy' : 'Offer'} ${escape(drink.name)}${orderTarget !== 'self' ? ` to ${escape(target?.name || group?.name)}` : ''}" ${alreadyOffered || cost > state.budget || state.ended ? 'disabled' : ''}>${orderTarget === 'self' ? (drink.price ? `$${drink.price}` : 'Free') : 'Offer'}</button></article>`;
  }).join('')}</div>${lastContext === 'menu' && lastResult ? `<p class="menu-receipt ${lastResult.ok ? '' : 'failed'}">${escape(lastResult.message)}</p>${lastResult.reactions.map(reaction => `<div class="group-reaction">${portrait(patronById(reaction.patronId))}<p><strong>${escape(patronById(reaction.patronId).name)}</strong>${escape(reaction.text)}</p></div>`).join('')}` : ''}<p class="drink-footnote">$${state.budget} left tonight. You only pay for accepted drinks. One offer per person; their company is always their choice.</p>${target ? `<button type="button" class="text-button" style="margin-top:15px" data-person="${target.id}">Back to ${escape(target.name)} ↗</button>` : group ? `<button type="button" class="text-button" style="margin-top:15px" data-group="${group.id}">Back to the table ↗</button>` : ''}</div><p class="panel-footnote">The best icebreaker is still a conversation. All prices are fictional game money.</p>`;
}
function showEnded() {
  return `${panelTop('LAST CALL', 'UNTIL NEXT TIME')}<div class="night-ended"><div class="welcome-mark" aria-hidden="true" style="font-size:55px">☾</div><h2>That was a night.</h2><p>Some laughs, a few brave opening lines, and a room full of stories.</p><button type="button" class="primary-button full-button" data-summary>See tonight’s story ↗</button><button type="button" class="secondary-button full-button" data-new-night>Another night · fresh $60</button></div><p class="panel-footnote">Your connections stay with you when you start a new evening.</p>`;
}
function renderPanel() {
  panel.innerHTML = state.ended ? showEnded() : selection.type === 'person' ? showPerson(selection.id) : selection.type === 'group' ? showGroup(selection.id) : selection.type === 'menu' ? showMenu() : showWelcome();
}
function select(type, id, focus = true) {
  selection = { type, ...(id ? { id } : {}) };
  scene?.select(id || null);
  updateRoom(); renderPanel();
  if (focus) {
    const focusTarget = type === 'welcome' && window.innerWidth <= 860 ? $('.lounge') : $('#conversation');
    focusTarget.setAttribute('tabindex', '-1'); focusTarget.focus({ preventScroll: true });
    if (window.innerWidth <= 860) focusTarget.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
}
function dispatch(action) {
  const result = applyAction(state, action);
  lastResult = result;
  lastContext = action.type === 'buy' ? 'menu' : action.patronId || action.groupId || null;
  if (result.ok) { state = result.state; save(); }
  updateRoom(); renderPanel(); announce(result.message);
  result.reactions?.forEach(reaction => scene?.react(reaction.patronId, reaction.tone));
  return result;
}
function showDialog(title, body) {
  $('#dialog-content').innerHTML = `<div class="dialog-header"><h2 id="dialog-title">${escape(title)}</h2><button type="button" class="close-button" data-close-dialog aria-label="Close dialog">×</button></div><div class="dialog-body">${body}</div>`;
  if (!dialog.open) dialog.showModal();
}
function contacts() {
  const entries = state.contacts.map(contact => {
    const p = patronById(contact.patronId);
    return `<article class="contact-entry">${portrait(p)}<div><h3>${escape(p.name)} <span class="outcome-badge">${contact.kind === 'date' ? 'DATE PLANNED' : 'NUMBERS EXCHANGED'}</span></h3><p>${contact.kind === 'date' ? escape(p.dateTitle) : 'A reason to say hello again.'}</p><p>Met on night ${contact.night} · ${escape(p.role)}</p></div></article>`;
  }).join('');
  showDialog('Good connections.', `<p>The people you clicked with, and the plans you made.</p>${entries || '<div class="empty-state"><span aria-hidden="true">♡</span><p>No numbers yet. A good conversation is a good start.</p><button type="button" class="primary-button" data-dialog-person="nova">Go meet someone ↗</button></div>'}<p class="tiny-note">Saved with your bar progress in this browser.</p>`);
}
function summary() {
  const value = getSummary(state);
  showDialog(state.ended ? 'Your night, in stories.' : 'Call it a night?', `<p>${state.ended ? 'The lights get softer. The jokes get retold.' : 'Take a look at your evening so far. You can keep mingling or close the tab for tonight.'}</p><div class="summary-grid"><div class="summary-stat"><strong>${value.laughs}</strong><span>LAUGHS SHARED</span></div><div class="summary-stat"><strong>${value.connections.length}</strong><span>CONNECTIONS</span></div><div class="summary-stat"><strong>$${value.spent}</strong><span>SPENT TONIGHT</span></div></div><div class="summary-note">${escape(value.bestMoment)}</div>${value.connections.map(item => `<article class="contact-entry">${portrait(patronById(item.patronId))}<div><h3>${escape(item.name)}</h3><p>${item.kind === 'date' ? escape(item.dateTitle) : 'Numbers exchanged. Potential sequel.'}</p></div></article>`).join('')}<div class="dialog-actions">${state.ended ? '<button type="button" class="primary-button" data-new-night>Start another night ↗</button>' : '<button type="button" class="secondary-button" data-close-dialog>Keep mingling</button><button type="button" class="primary-button" data-confirm-end>End this night</button>'}</div>`);
}
function showEvent(id) {
  const event = EVENTS.find(item => item.id === id); if (!event) return;
  showDialog(event.title, `<p>${escape(event.text)}</p><div class="choices">${event.choices.map(choice => `<button type="button" class="choice" data-event="${event.id}" data-event-choice="${choice.id}"><span class="choice-text">${escape(choice.text)}</span><span class="choice-arrow" aria-hidden="true">↗</span></button>`).join('')}</div>`);
}

document.addEventListener('click', event => {
  const button = event.target.closest('button'); if (!button || button.disabled) return;
  if (button.hasAttribute('data-person')) select('person', button.dataset.person);
  else if (button.hasAttribute('data-group')) select('group', button.dataset.group);
  else if (button.hasAttribute('data-welcome')) select('welcome');
  else if (button.dataset.action) {
    dispatch({ type: button.dataset.action, ...(button.dataset.action === 'talk' ? { patronId: button.dataset.id } : { groupId: button.dataset.id }), lineId: button.dataset.line });
    $('#conversation').focus({ preventScroll: true });
  } else if (button.dataset.invite) { dispatch({ type: 'invite', patronId: button.dataset.id, kind: button.dataset.invite }); $('#conversation').focus({ preventScroll: true }); }
  else if (button.dataset.recover) { dispatch({ type: 'recover', patronId: button.dataset.recover }); $('#conversation').focus({ preventScroll: true }); }
  else if (button.dataset.offer) { orderTarget = button.dataset.offer; select('menu'); }
  else if (button.dataset.drink) { dispatch({ type: 'buy', drinkId: button.dataset.drink, target: orderTarget }); $('#conversation').focus({ preventScroll: true }); }
  else if (button.hasAttribute('data-close-dialog')) dialog.close();
  else if (button.dataset.dialogPerson) { dialog.close(); select('person', button.dataset.dialogPerson); }
  else if (button.hasAttribute('data-summary')) summary();
  else if (button.hasAttribute('data-confirm-end')) { dispatch({ type: 'end-night' }); summary(); }
  else if (button.hasAttribute('data-new-night')) { dispatch({ type: 'new-night' }); dialog.close(); lastResult = null; lastContext = null; select('welcome'); }
  else if (button.dataset.openEvent) showEvent(button.dataset.openEvent);
  else if (button.dataset.event) { dispatch({ type: 'event', eventId: button.dataset.event, choiceId: button.dataset.eventChoice }); dialog.close(); $('#conversation').focus({ preventScroll: true }); }
});
document.addEventListener('change', event => { if (event.target.id === 'drink-recipient') { orderTarget = event.target.value; renderPanel(); $('#drink-recipient')?.focus(); } });
document.addEventListener('keydown', event => {
  if (dialog.open || event.repeat || event.altKey || event.ctrlKey || event.metaKey || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName) || event.target.isContentEditable) return;
  if (/^[1-4]$/.test(event.key)) { const choices = [...panel.querySelectorAll('.choice[data-action]')]; const chosen = choices[Number(event.key) - 1]; if (chosen) { event.preventDefault(); chosen.click(); } }
  if (event.key === 'Escape' && selection.type !== 'welcome') select('welcome');
});
$('#open-menu').addEventListener('click', () => { orderTarget = 'self'; select('menu'); });
$('#contacts-toggle').addEventListener('click', contacts);
$('#end-night').addEventListener('click', summary);
$('#sound-toggle').addEventListener('click', async () => {
  try { soundOn = await audio.setEnabled(!soundOn); $('#sound-toggle').setAttribute('aria-pressed', String(soundOn)); $('#sound-toggle').setAttribute('aria-label', `Turn lounge music ${soundOn ? 'off' : 'on'}`); $('#sound-toggle span').textContent = `Sound ${soundOn ? 'on' : 'off'}`; }
  catch { announce('Music could not start in this browser. The bar is still open.'); }
});
dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
window.addEventListener('pagehide', () => { clearTimeout(toastTimer); scene?.dispose(); audio.dispose(); });
// The page owns disposable renderer/audio resources, so reinitialize after a bfcache return.
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });

updateRoom(); renderPanel(); save();
try {
  const { createBarScene } = await import('./scene.js');
  scene = createBarScene($('#bar-scene'), { patrons: PATRONS, groups: GROUPS, onSelectPatron: id => select('person', id), onSelectGroup: id => select('group', id), onBartender: () => { orderTarget = 'self'; select('menu'); }, reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches });
  scene.setMood(state.ended ? 'closed' : 'open');
} catch (error) {
  $('#bar-scene').innerHTML = '<div class="scene-fallback"><span style="font-size:38px;color:#ebc285" aria-hidden="true">ʕ•ᴥ•ʔ</span><strong>The Social Bear</strong><p>The 3D room couldn’t load, but everyone’s still here. Choose a guest or table below to play the full night.</p></div>';
  $('#scene-instruction').textContent = 'Choose a guest or a table below';
  console.warn('Bar room unavailable; conversation mode remains playable.', error?.message);
}
