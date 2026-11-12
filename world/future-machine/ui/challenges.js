import { QUESTIONS, createChallengeURL } from '../share/challenges.js';

export function createChallengeCards(host, {getContext}) {
  const doc = host.ownerDocument, panel = doc.createElement('details');
  panel.className = 'fm-story fm-challenges';
  const summary = doc.createElement('summary');summary.textContent = 'Challenge a friend: three policy questions';
  const help = doc.createElement('p');help.textContent = 'Optional: edit a question and share the displayed run and month. Links include synthetic scenario evidence and your text; avoid personal information. Questions are prompts, not measured impacts. A saved run is required to reopen them.';
  const status = doc.createElement('p');status.setAttribute('role','status');
  const received = doc.createElement('p');received.hidden = true;
  panel.append(summary, help, received);
  let generation = 0, disposed = false;
  const rows = QUESTIONS.map((question, i) => {
    const row = doc.createElement('div'), label = doc.createElement('label'), input = doc.createElement('textarea');
    label.textContent = `Question ${i+1}`;input.value = question;input.maxLength = 200;input.rows = 2;label.append(input);
    const button = doc.createElement('button');button.type = 'button';button.textContent = `Share question ${i+1}`;button.disabled = true;
    const link = doc.createElement('a');link.textContent = `Open question ${i+1} link`;link.hidden = true;
    input.oninput = () => {generation++;link.hidden = true;link.removeAttribute('href');};
    button.onclick = async () => {
      const token = ++generation, context = getContext();
      status.textContent = 'Preparing validated scenario receipt…';
      try {
        const url = await createChallengeURL(context.history, {question:input.value, month:context.month}, doc.defaultView.location.href);
        if (disposed || token !== generation) return;
        link.href = url;link.hidden = false;status.textContent = 'Challenge link ready. Copy the link to share.';
      } catch (error) {if (!disposed && token === generation) status.textContent = error.message;}
    };
    row.append(label, button, link);panel.append(row);
    return {input, button, link};
  });
  panel.append(status);host.append(panel);
  let identity;
  return {
    update(state) {
      const key = `${state.experimentId}:${state.month}:${state.status}`;
      if (key !== identity) {generation++;for (const row of rows) {row.link.hidden = true;row.link.removeAttribute('href');}status.textContent = '';identity = key;}
      for (const row of rows) row.button.disabled = state.status !== 'ready';
      received.hidden = !state.challengeQuestion;received.textContent = state.challengeQuestion ? `Shared question: ${state.challengeQuestion}` : '';
      if (state.challengeQuestion) panel.open = true;
    },
    dispose() {disposed = true;generation++;panel.remove();}
  };
}
