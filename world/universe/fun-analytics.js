// Reporting contract only. Collection and cross-visit identity require SHE-56 review.
export const FUN_METRICS = Object.freeze([
  {id:'activation', label:'Activation', numerator:'Eligible sessions with a first accepted meaningful interaction (a supported choice or intervention).', denominator:'All eligible sessions beginning in the reporting window.', limitation:'Opening a page or experience is not activation.'},
  {id:'experiments', label:'Completed experiments', numerator:'Explicitly started experiments that successfully produce a complete inspectable result.', denominator:'All explicitly started experiments in the reporting window, including failed or abandoned starts.', limitation:'Worker progress, previews and page entry are not completion.'},
  {id:'replays', label:'Voluntary replays', numerator:'Eligible completed sessions with a subsequent player-requested replay after a completed experiment.', denominator:'Eligible sessions with at least one completed experiment in the reporting window.', limitation:'Exclude automatic retries, reloads, guided mandatory reruns and duplicate receipts.'},
  {id:'returns', label:'Return visits (7 days)', numerator:'Consenting browser cohorts with a distinct eligible session on a later UTC day, within seven days of their first eligible session.', denominator:'Consenting browsers first seen in the reporting window with a full seven-day observation period.', limitation:'Anonymous browser cohorts are not people. Immature cohorts are excluded; shared-link returns need a separate consented source dimension.'},
  {id:'enjoyment', label:'Optional enjoyment feedback', numerator:'Explicit positive responses to the optional “Did you enjoy this experiment?” question, once per completed experiment.', denominator:'All explicit positive, neutral or negative responses for completed experiments in the reporting window.', limitation:'Skipped feedback is missing, never negative. Also report response coverage: answered experiments / completed experiments offered feedback. Behavior cannot establish enjoyment.'}
].map(Object.freeze));

export function mountFunAnalytics(container) {
  const doc = container.ownerDocument;
  const panel = doc.createElement('section');
  panel.setAttribute('aria-label', 'Player fun metrics');
  const heading = doc.createElement('h3'); heading.textContent = 'Player fun metrics';
  const note = doc.createElement('p');
  note.textContent = 'Unavailable — consented first-play events and the SHE-56 privacy sign-off are pending. No player data is collected by this panel. Local journey counts cannot establish these rates.';
  const list = doc.createElement('dl');
  for (const metric of FUN_METRICS) {
    const title = doc.createElement('dt'); title.textContent = `${metric.label}: unavailable`;
    const definition = doc.createElement('dd');
    definition.textContent = `Numerator: ${metric.numerator} Denominator: ${metric.denominator} ${metric.limitation}`;
    list.append(title, definition);
  }
  panel.append(heading, note, list);
  const engineering = doc.createElement('section');
  engineering.setAttribute('aria-label', 'Engineering throughput');
  const engineeringHeading = doc.createElement('h3'); engineeringHeading.textContent = 'Engineering throughput';
  const engineeringNote = doc.createElement('p');
  engineeringNote.textContent = 'Unavailable in this browser. Worker and delivery throughput belong to the engineering dashboard and do not measure player enjoyment.';
  engineering.append(engineeringHeading, engineeringNote);
  container.append(panel, engineering);
  return {destroy() { panel.remove(); engineering.remove(); }};
}
