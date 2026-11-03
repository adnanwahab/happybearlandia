/** A view of actual household comedy actions; the simulation owns every outcome. */
export function mountHouseComedy(container, {
  onCommand, onResume, onFrameObject, onFramePerson,
} = {}) {
  const doc = container.ownerDocument;
  const dialog = doc.createElement('dialog');
  dialog.className = 'house-comedy-dialog';
  dialog.setAttribute('aria-label', 'Household nonsense');
  dialog.innerHTML = `
    <header class="house-comedy-header">
      <div><p class="house-comedy-eyebrow">HOUSEHOLD NONSENSE</p><h2 data-comedy-title></h2></div>
      <button type="button" class="house-comedy-close" data-comedy-close aria-label="Close household nonsense">×</button>
    </header>
    <p class="house-comedy-intro" data-comedy-intro></p>
    <div class="house-comedy-casting">
      <label>Who's causing trouble?<select data-comedy-person aria-label="Choose a resident to cause trouble"></select></label>
      <span class="house-comedy-counter" data-comedy-count></span>
    </div>
    <p class="house-comedy-person-note" data-comedy-person-note></p>
    <section class="house-comedy-objective" aria-label="Next household comedy objective">
      <span class="house-comedy-eyebrow" data-comedy-objective-label>YOUR NEXT BAD IDEA</span>
      <p data-comedy-objective></p>
    </section>
    <section class="house-comedy-active" data-comedy-active hidden aria-label="Comedy action in progress">
      <div class="house-comedy-active-heading"><h3 data-comedy-active-title></h3><span data-comedy-active-time></span></div>
      <blockquote data-comedy-active-quote></blockquote>
      <p data-comedy-active-status></p>
      <progress max="1" value="0" data-comedy-progress aria-label="Comedy action progress"></progress>
      <div class="house-comedy-watch-controls">
        <button type="button" data-comedy-resume>▶ Resume the chaos</button>
        <button type="button" class="house-comedy-primary" data-comedy-watch>Watch the disaster ↗</button>
      </div>
    </section>
    <div class="house-comedy-episodes" data-comedy-episodes></div>
    <section class="house-comedy-result" data-comedy-result hidden aria-label="The latest household disaster">
      <span class="house-comedy-eyebrow">THAT REALLY HAPPENED</span>
      <h3 data-comedy-result-title></h3>
      <p data-comedy-result-text></p>
      <blockquote data-comedy-result-quote></blockquote>
      <blockquote class="house-comedy-witness" data-comedy-witness></blockquote>
      <button type="button" data-comedy-see>See the souvenir ↗</button>
    </section>
    <section class="house-comedy-souvenirs" data-comedy-souvenirs hidden aria-label="Earned comedy souvenirs">
      <h3>Questionable achievements</h3><div data-comedy-achievements></div>
    </section>
    <details class="house-comedy-memories" data-comedy-memories hidden>
      <summary>Things this household will never let you forget</summary><ol data-comedy-memory-list></ol>
    </details>
    <p class="house-comedy-message" data-comedy-message role="status" aria-live="polite"></p>
    <footer class="house-comedy-footer"><span>DIGNITY OPTIONAL.</span><button type="button" data-comedy-done>Back to the house</button></footer>`;
  container.append(dialog);
  const $ = selector => dialog.querySelector(selector);
  const list = value => Array.isArray(value) ? value : [];
  const element = (tag, text, parent, className) => {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = String(text);
    parent.append(node);
    return node;
  };
  const cards = new Map(), actorOptions = new Map(), receipts = new Map();
  const icon = { 'fridge-strike': '♨', 'sofa-election': '♛', 'porcelain-tribunal': '⚖' };
  let data = {}, selected = null, manuallySelected = false, busy = false, destroyed = false;
  let message = '', messageIsError = false, admission = null, target = null, sequence = 0;
  let inspectionVersion = 0;
  let lastExternalSelection, renderedResult = '', renderedMemories = '', renderedAchievements = '';
  const state = () => data.comedy ?? {};
  const actors = () => list(state().actors);
  const selectedActor = () => actors().find(actor => actor.personId === selected);
  const episode = id => list(state().episodes).find(row => row.id === id);
  const currentAction = () => state().active ?? admission;
  const name = id => actors().find(actor => actor.personId === id)?.name
    ?? list(data.people).find(person => (person.personId ?? person.id) === id)?.name ?? 'Your resident';
  const close = () => { if (dialog.open) dialog.close(); };
  const writeMessage = (text, error = false) => {
    message = text ?? '';
    messageIsError = error;
    if (destroyed) return;
    $('[data-comedy-message]').textContent = message;
    $('[data-comedy-message]').classList.toggle('is-error', messageIsError);
  };

  function blockedReason(chapter, choice) {
    if (busy) return 'Checking that request…';
    if (!onCommand) return 'Household actions are unavailable.';
    if (chapter.completed) return 'This chapter already happened.';
    if (currentAction()) return 'Let the current disaster finish first.';
    if (!chapter.available) return chapter.lockedReason ?? 'Finish the previous chapter first.';
    const actor = selectedActor();
    if (!actor) return 'Choose a resident first.';
    if (!actor.available) return actor.reason ?? 'This resident is unavailable right now.';
    if (choice.available === false) return choice.reason ?? 'This choice is unavailable right now.';
    return '';
  }

  async function perform(episodeId, choiceId) {
    if (destroyed) return;
    const chapter = episode(episodeId), choice = list(chapter?.choices).find(row => row.id === choiceId);
    if (!chapter || !choice) return;
    const reason = blockedReason(chapter, choice);
    if (reason) { writeMessage(reason, true); return; }
    const personId = selected;
    const objectId = target?.episodeId === episodeId ? target.objectId : undefined;
    const key = JSON.stringify([episodeId, choiceId, personId, objectId ?? null]);
    let receipt = receipts.get(key);
    if (!receipt) {
      const commandId = doc.defaultView?.crypto?.randomUUID?.() ?? `comedy-ui-${Date.now().toString(36)}-${++sequence}`;
      const input = { system: 'comedy', type: 'perform', episodeId, choiceId, personId, commandId };
      if (objectId) input.objectId = objectId;
      receipt = { input, knownEventIds: new Set(list(state().events).map(event => event.id)) };
      receipts.set(key, receipt);
      if (receipts.size > 24) receipts.delete(receipts.keys().next().value);
    }
    busy = true;
    writeMessage('One moment. The furniture is reviewing your terrible idea.');
    render();
    try {
      const response = await onCommand(receipt.input);
      if (response?.accepted !== true) {
        // A definite rejection creates no action. A new attempt is a new intent.
        receipts.delete(key);
        throw Error(response?.reason ?? 'That request could not start.');
      }
      // Only uncertain transport failures retain an idempotency key for retry.
      receipts.delete(key);
      if (destroyed) return;
      // A receipt acknowledges admission, never completion. Keep further clicks locked
      // until the next fresh inspection reconciles the acknowledged action.
      const endedDuringRequest = list(state().events).some(event => !receipt.knownEventIds.has(event.id)
        && event.episodeId === episodeId && event.choiceId === choiceId
        && /cancel|interrupt|complete|payoff/.test(event.type ?? ''));
      if (!state().active && !episode(episodeId)?.completed && !endedDuringRequest) {
        admission = { episodeId, choiceId, personId, objectId, title: chapter.title, awaitingInspection: true, inspectionVersion };
      }
      writeMessage('Terrible idea accepted. Watch your resident carry it out.');
    } catch (error) {
      if (!destroyed) writeMessage(error?.message ?? 'That request could not start.', true);
    } finally {
      busy = false;
      if (!destroyed) render();
    }
  }

  function renderActors() {
    const availableActors = actors(), ids = new Set(availableActors.map(actor => actor.personId));
    if (!ids.has(selected)) {
      selected = ids.has(data.selectedPersonId) ? data.selectedPersonId
        : availableActors.find(actor => actor.available)?.personId ?? availableActors[0]?.personId ?? null;
      manuallySelected = false;
    }
    const select = $('[data-comedy-person]');
    for (const actor of availableActors) {
      let option = actorOptions.get(actor.personId);
      if (!option) {
        option = element('option', '', select);
        option.value = actor.personId;
        actorOptions.set(actor.personId, option);
      }
      option.textContent = (actor.name ?? 'Resident') + (actor.available ? '' : ' · unavailable');
    }
    for (const [id, option] of actorOptions) if (!ids.has(id)) { option.remove(); actorOptions.delete(id); }
    if (selected) select.value = selected;
    select.disabled = busy || !!currentAction() || !availableActors.length;
    const actor = selectedActor();
    $('[data-comedy-person-note]').textContent = actor && !actor.available
      ? actor.reason ?? 'This resident is unavailable right now.'
      : availableActors.length ? 'Choose an approach. Then watch the consequences in your house.'
      : 'No resident is available to cause trouble yet.';
  }

  function renderAction() {
    const action = currentAction(), root = $('[data-comedy-active]');
    root.hidden = !action;
    if (!action) return;
    $('[data-comedy-active-title]').textContent = action.title ?? episode(action.episodeId)?.title ?? 'A questionable decision';
    const duration = Number(action.durationMinutes), elapsed = Number(action.elapsedMinutes ?? 0);
    const fraction = Number.isFinite(duration) && duration > 0 ? Math.max(0, Math.min(1, elapsed / duration)) : 0;
    $('[data-comedy-progress]').value = fraction;
    $('[data-comedy-progress]').hidden = action.awaitingInspection === true;
    $('[data-comedy-active-time]').textContent = Number.isFinite(duration) && duration > 0
      ? Math.ceil(Math.max(0, duration - elapsed)) + ' min to go' : '';
    const quote = $('[data-comedy-active-quote]');
    quote.textContent = action.quote ? `${action.speaker ? action.speaker + ': ' : ''}“${action.quote}”` : '';
    quote.hidden = !action.quote;
    $('[data-comedy-active-status]').textContent = data.paused
      ? 'The house is paused. Resume to let the scene play out.'
      : elapsed > 0 ? `${name(action.personId)} is dealing with the situation.`
      : `${name(action.personId)} is getting into position.`;
    const resume = $('[data-comedy-resume]');
    resume.hidden = !data.paused || !onResume;
    resume.disabled = busy;
  }

  function renderChapters() {
    const chapters = list(state().episodes), ids = new Set(chapters.map(chapter => chapter.id));
    for (const [id, entry] of cards) if (!ids.has(id)) { entry.card.remove(); cards.delete(id); }
    chapters.forEach((chapter, index) => {
      let entry = cards.get(chapter.id);
      if (!entry) {
        const card = element('article', null, $('[data-comedy-episodes]'), 'house-comedy-episode');
        card.dataset.comedyEpisode = chapter.id;
        card.tabIndex = -1;
        const head = element('div', null, card, 'house-comedy-chapter-head');
        const number = element('span', '', head, 'house-comedy-chapter-number');
        number.setAttribute('aria-hidden', 'true');
        const heading = element('div', null, head);
        const kicker = element('span', '', heading, 'house-comedy-eyebrow');
        const title = element('h3', '', heading);
        const badge = element('span', '', head, 'house-comedy-chapter-state');
        const description = element('p', '', card, 'house-comedy-chapter-description');
        const choices = element('div', null, card, 'house-comedy-choices');
        const reason = element('p', '', card, 'house-comedy-chapter-reason');
        entry = { card, number, kicker, title, badge, description, choices, reason, buttons: new Map() };
        cards.set(chapter.id, entry);
      }
      entry.number.textContent = icon[chapter.id] ?? String(index + 1).padStart(2, '0');
      entry.kicker.textContent = 'CHAPTER ' + String(index + 1).padStart(2, '0');
      entry.title.textContent = chapter.title;
      entry.description.textContent = chapter.description ?? '';
      const active = currentAction()?.episodeId === chapter.id;
      entry.badge.textContent = chapter.completed ? '✓ Survived' : active ? 'In progress' : chapter.available ? 'Your move' : 'Up next';
      entry.card.classList.toggle('is-complete', !!chapter.completed);
      entry.card.classList.toggle('is-active', !!active);
      entry.card.classList.toggle('is-available', !!chapter.available && !chapter.completed && !currentAction());
      const choiceIds = new Set(list(chapter.choices).map(choice => choice.id));
      for (const [id, button] of entry.buttons) if (!choiceIds.has(id)) { button.root.remove(); entry.buttons.delete(id); }
      for (const choice of list(chapter.choices)) {
        let button = entry.buttons.get(choice.id);
        if (!button) {
          const root = element('button', null, entry.choices, 'house-comedy-choice');
          root.type = 'button';
          const label = element('strong', '', root), hint = element('span', '', root);
          root.onclick = () => void perform(chapter.id, choice.id);
          button = { root, label, hint };
          entry.buttons.set(choice.id, button);
        }
        const blocked = blockedReason(chapter, choice);
        button.label.textContent = choice.label;
        button.hint.textContent = choice.available === false ? choice.reason ?? choice.hint ?? '' : choice.hint ?? '';
        button.root.disabled = !!blocked;
        button.root.title = blocked;
      }
      entry.choices.hidden = !!chapter.completed;
      entry.reason.textContent = chapter.completed
        ? 'The deed is done. Your household will remember.'
        : active ? 'This is happening in the house. Watch it play out.'
        : !chapter.available ? chapter.lockedReason ?? 'Finish the previous chapter to unlock this one.' : '';
      entry.reason.hidden = !entry.reason.textContent;
    });
    const completed = chapters.filter(chapter => chapter.completed).length;
    $('[data-comedy-count]').textContent = chapters.length ? `${completed} / ${chapters.length} disasters survived` : '';
    const action = currentAction(), next = chapters.find(chapter => !chapter.completed);
    $('[data-comedy-objective-label]').textContent = action ? 'NOW PLAYING' : next ? 'YOUR NEXT BAD IDEA' : 'HOUSEHOLD GOVERNMENT FORMED';
    $('[data-comedy-objective]').textContent = action
      ? action.title ?? episode(action.episodeId)?.title ?? 'A household disaster is underway.'
      : next ? next.available ? next.title : next.lockedReason ?? next.title
      : chapters.length ? 'Normal life may now resume. Subject to approval.' : 'Preparing the household’s next questionable adventure…';
  }

  function latestOutcome() {
    const memory = list(state().memories).at(-1);
    if (!memory) return null;
    const event = list(state().events).findLast(row => row.episodeId === memory.episodeId
      && row.choiceId === memory.choiceId && row.minute === memory.minute);
    return { ...episode(memory.episodeId)?.outcome, ...memory, ...event, title: memory.title ?? episode(memory.episodeId)?.title ?? 'A memorable disaster' };
  }

  function souvenirObject(outcome) {
    return list(state().souvenirs).find(row => row.episodeId === outcome?.episodeId
      && row.choiceId === outcome?.choiceId)?.objectId ?? outcome?.objectId;
  }

  function renderOutcomes() {
    const outcome = latestOutcome(), signature = JSON.stringify(outcome);
    $('[data-comedy-result]').hidden = !outcome;
    if (signature !== renderedResult) {
      renderedResult = signature;
      if (outcome) {
        $('[data-comedy-result-title]').textContent = outcome.title;
        $('[data-comedy-result-text]').textContent = outcome.text ?? '';
        const quote = $('[data-comedy-result-quote]');
        quote.textContent = outcome.quote ? `${outcome.speaker ? outcome.speaker + ': ' : ''}“${outcome.quote}”` : '';
        quote.hidden = !outcome.quote;
        const witness = $('[data-comedy-witness]');
        witness.textContent = outcome.witness?.quote ? `${outcome.witness.name ?? name(outcome.witness.personId)}: “${outcome.witness.quote}”` : '';
        witness.hidden = !outcome.witness?.quote;
      }
    }
    $('[data-comedy-see]').hidden = !souvenirObject(outcome) || !onFrameObject;
    const achievements = list(state().achievements).slice(-6), achievementKey = JSON.stringify(achievements);
    $('[data-comedy-souvenirs]').hidden = !achievements.length;
    if (achievementKey !== renderedAchievements) {
      renderedAchievements = achievementKey;
      const host = $('[data-comedy-achievements]');
      host.replaceChildren();
      for (const achievement of achievements) {
        const badge = element('article', null, host, 'house-comedy-achievement');
        element('strong', '✦ ' + (achievement.title ?? 'Questionable achievement'), badge);
        if (achievement.description) element('small', achievement.description, badge);
      }
    }
    const callbacks = list(state().events).filter(event => event.type === 'comedy-callback')
      .map(event => ({ ...event, title: (event.speaker ?? 'The household') + ' is still bringing it up' }));
    const memories = [...list(state().memories), ...callbacks]
      .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0)).slice(-8);
    const memoryKey = JSON.stringify(memories);
    $('[data-comedy-memories]').hidden = !memories.length;
    if (memoryKey !== renderedMemories) {
      renderedMemories = memoryKey;
      const host = $('[data-comedy-memory-list]');
      host.replaceChildren();
      for (const memory of [...memories].reverse()) {
        const row = element('li', null, host);
        element('strong', memory.title ?? 'An unforgettable incident', row);
        element('p', memory.text ?? '', row);
      }
    }
  }

  function render() {
    if (destroyed) return;
    $('[data-comedy-title]').textContent = state().title ?? 'The House Has Formed a Government';
    $('[data-comedy-intro]').textContent = state().description ?? 'Three small domestic issues. One catastrophically unnecessary government.';
    renderActors();
    renderAction();
    renderChapters();
    renderOutcomes();
    writeMessage(message, messageIsError);
  }

  $('[data-comedy-person]').onchange = event => {
    selected = event.target.value;
    manuallySelected = true;
    writeMessage('');
    render();
  };
  $('[data-comedy-close]').onclick = close;
  $('[data-comedy-done]').onclick = close;
  $('[data-comedy-watch]').onclick = () => {
    const action = currentAction();
    close();
    if (action?.personId && onFramePerson) onFramePerson(action.personId);
    else if (action?.objectId) onFrameObject?.(action.objectId);
  };
  $('[data-comedy-see]').onclick = () => {
    const outcome = latestOutcome();
    close();
    const objectId = souvenirObject(outcome);
    if (objectId) onFrameObject?.(objectId);
  };
  $('[data-comedy-resume]').onclick = async () => {
    if (busy || destroyed || !onResume) return;
    busy = true;
    render();
    try { await onResume(); writeMessage('The house is running. Watch the disaster unfold.'); }
    catch (error) { writeMessage(error?.message ?? 'Could not resume the house.', true); }
    finally { busy = false; if (!destroyed) render(); }
  };
  dialog.addEventListener('close', () => { target = null; });

  function open(options = {}) {
    if (destroyed) return;
    target = options.episodeId ? { episodeId: options.episodeId, objectId: options.objectId } : null;
    if (options.personId && actors().some(actor => actor.personId === options.personId)) {
      selected = options.personId;
      manuallySelected = true;
    } else if (!manuallySelected && data.selectedPersonId) selected = data.selectedPersonId;
    render();
    if (!dialog.open) dialog.showModal();
    const card = options.episodeId ? cards.get(options.episodeId)?.card : null;
    if (card) { card.focus({ preventScroll: true }); card.scrollIntoView({ block: 'nearest', behavior: 'instant' }); }
  }

  return {
    open,
    close,
    update(value = {}) {
      if (destroyed) return;
      data = value;
      inspectionVersion++;
      if (!dialog.open && data.selectedPersonId !== lastExternalSelection) {
        selected = data.selectedPersonId ?? selected;
        manuallySelected = false;
      }
      lastExternalSelection = data.selectedPersonId;
      if (admission && inspectionVersion > admission.inspectionVersion) admission = null;
      for (const [key, receipt] of receipts) {
        const input = receipt.input, active = state().active;
        const sameAttempt = event => event.episodeId === input.episodeId
          && event.choiceId === input.choiceId && event.personId === input.personId;
        const confirmed = active && sameAttempt(active)
          || episode(input.episodeId)?.completed
          || list(state().events).some(event => !receipt.knownEventIds.has(event.id) && sameAttempt(event));
        // This also releases an uncertain key when its lost response is later
        // reconciled as a started, completed, or interrupted action.
        if (confirmed) receipts.delete(key);
      }
      render();
    },
    destroy() {
      destroyed = true;
      close();
      dialog.remove();
      cards.clear();
      actorOptions.clear();
      receipts.clear();
    },
  };
}
