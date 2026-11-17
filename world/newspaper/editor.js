import { DEMO_RUN_ID } from './editions.js';

export const EDITOR_VERSION = 'newspaper-editor-1';
export const FLAVOR = 'A turning point for Riverside';
// Editorial rules only: these phrases never assert modeled causes or predictions.
export function createDesk(archive) {
  if (archive.state !== 'ready' || archive.run?.context?.runId !== DEMO_RUN_ID) return null;
  return JSON.parse(JSON.stringify({ run: archive.run, stories: archive.editions.flatMap(e => e.stories) }));
}

export function reviewPage(desk, selections, current) {
  const errors = [];
  if (!desk || !desk.stories.length || !current) return { ok: false, errors: ['No source data. Record the pinned monthly demo first.'] };
  if (JSON.stringify(desk) !== JSON.stringify(current)) errors.push('Replay/source mismatch. Reopen the editor; no results were invented.');
  if (selections.length !== 3 || new Set(selections.map(s => s.id)).size !== 3) errors.push('Choose exactly 3 different headlines.');
  const claims = selections.map(selection => {
    const story = desk.stories.find(s => s.event.id === selection.id);
    if (!story?.event.provenance?.source || story.event.provenance.kind !== 'simulated') errors.push('Unsupported source.');
    if (selection.treatment !== 'record') errors.push('Unsupported headline: this record cannot prove a future is guaranteed.');
    if (selection.label !== 'interpretation') errors.push('Label the dramatic phrase as interpretation.');
    return story;
  });
  if (errors.length) return { ok: false, errors: [...new Set(errors)] };
  return { ok: true, errors: [], page: {
    version: EDITOR_VERSION, run: desk.run,
    limitation: 'Synthetic toy City model outputs; no measured observations. Scripted flavor is interpretation. No forecast or causal proof. Recorded evidence only; no independently verified recomputation claimed.',
    claims: claims.map(s => ({ headline: s.headline, fact: s.copy, interpretation: FLAVOR, event: s.event, href: s.href })),
  } };
}
