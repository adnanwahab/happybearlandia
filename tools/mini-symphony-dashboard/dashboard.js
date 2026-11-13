const $ = id => document.getElementById(id);
const el = (tag, text, className) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; };
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const integer = value => Math.max(0, Math.round(number(value))).toLocaleString();
const duration = value => {
  if (value === undefined || value === null || !Number.isFinite(Number(value))) return '—';
  const seconds = Math.max(0, Math.floor(Number(value) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds % 3600 / 60);
  return hours ? `${hours}h ${String(minutes).padStart(2, '0')}m` : `${minutes}m`;
};
const date = value => { if(!value)return '—'; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); };
const phaseNames = { starting: 'Starting', working: 'Coding', publishing: 'Publishing', waiting: 'Waiting for work', syncing: 'Refreshing board', stopping: 'Stopping', stopped: 'Stopped', error: 'Error' };
const eventNames = { session_started: 'Session started', heartbeat: 'Heartbeat', phase_changed: 'Activity changed', task_started: 'Task started', task_finished: 'Task finished', pr_created: 'Draft PR created', publish_failed: 'Publication failed', queue_snapshot: 'Queue checked', sync_finished: 'Board refreshed', sync_failed: 'Board refresh failed', session_stopped: 'Session stopped', operator_intervention: 'Intervention recorded', task_output: 'Worker activity' };
let data, projectId, sessionId, fetching = false, lastFetch = 0;
let announcedNotice = '';
function notice(message) { if (message !== announcedNotice) { $('notice').textContent = message; $('notice').hidden = !message; announcedNotice = message; } }
function safeLink(value) { try { const url = new URL(value); return url.protocol === 'https:' && ['github.com', 'linear.app'].includes(url.hostname) ? url.href : null; } catch { return null; } }
function sessionsFor(project) { return [...(project?.sessions ?? [])].sort((a, b) => number(new Date(b.metrics?.startedAt ?? b.startedAt).getTime()) - number(new Date(a.metrics?.startedAt ?? a.startedAt).getTime())); }
function setOptions(select, items, selected, empty) {
  const signature = JSON.stringify(items.map(item => [item.value, item.label]));
  if (select.dataset.signature !== signature) {
    select.replaceChildren(...(items.length ? items.map(item => { const option = el('option', item.label); option.value = item.value; return option; }) : [el('option', empty)]));
    select.dataset.signature = signature;
  }
  select.disabled = !items.length;
  if (items.length) select.value = selected;
}
function badge(node, text, tone = 'neutral') { node.textContent = text; node.className = `status-badge ${tone}`; }
function queue(project) {
  const values = project?.queue;
  for (const [id, key] of [['queue-runnable', 'runnable'], ['queue-running', 'running'], ['queue-disabled', 'disabled'], ['queue-review', 'priorAttempts']]) $(id).textContent = values ? integer(values[key]) : '—';
}
function renderTimeline(metrics) {
  const container = $('activity-timeline'); container.replaceChildren();
  const timeline = (metrics?.timeline ?? []).filter(segment => number(segment.durationMs) > 0);
  const total = timeline.reduce((sum, segment) => sum + number(segment.durationMs), 0);
  if (!total) { container.append(el('span', 'The session timeline will appear here', 'empty-timeline')); container.setAttribute('aria-label', 'No measured activity timeline'); $('timeline-end').textContent = 'No observations yet'; return; }
  const compact = [];
  for (const segment of timeline) {
    const kind = segment.observed === false ? 'unknown' : ({ working: 'coding', publishing: 'publishing', waiting: 'waiting', syncing: 'syncing' }[segment.phase] ?? 'unknown');
    const previous = compact.at(-1);
    if (previous?.kind === kind) previous.durationMs += number(segment.durationMs);
    else compact.push({ kind, durationMs: number(segment.durationMs) });
  }
  // Aggregate very long histories into bounded visual bins without changing totals.
  const visual = compact.length <= 300 ? compact : compact.slice(-300);
  const visualTotal = visual.reduce((sum, segment) => sum + segment.durationMs, 0);
  for (const segment of visual) {
    const bar = el('span', undefined, segment.kind); bar.style.width = `${segment.durationMs / visualTotal * 100}%`; bar.title = `${segment.kind}: ${duration(segment.durationMs)}`; container.append(bar);
  }
  container.setAttribute('aria-label', `Recorded activity: coding ${duration(metrics.codingMs)}, publishing ${duration(metrics.publishingMs)}, waiting ${duration(metrics.waitingMs)}, unknown ${duration(metrics.unknownMs)}.${compact.length > 300 ? ' Visual shows the latest 300 phase segments.' : ''}`);
  $('timeline-end').textContent = `${compact.length > 300 ? 'Latest activity · ' : ''}${duration(metrics.elapsedMs)} elapsed`;
}
function renderEvents(session) {
  const container = $('event-list');
  const showHeartbeats = $('show-heartbeats').checked;
  const events = (session?.events ?? []).filter(event => showHeartbeats || event.type !== 'heartbeat').slice(-45).reverse();
  container.replaceChildren();
  if (!events.length) { container.append(el('li', session ? 'No matching events in this session yet.' : 'No session events yet.', 'event-empty')); return; }
  for (const event of events) {
    const row = el('li'); const time = el('time'); const parsed = new Date(event.at);
    time.textContent = Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }); time.dateTime = event.at ?? ''; time.title = date(event.at);
    const text = el('div', undefined, 'event-text'); text.append(el('strong', event.taskId ? `${event.taskId} · ${eventNames[event.type] ?? event.type}` : eventNames[event.type] ?? event.type));
    const message = event.message ?? (event.type === 'heartbeat' ? phaseNames[event.phase] ?? event.phase : event.details?.reason ?? event.details?.status ?? '');
    if (message) text.append(document.createTextNode(String(message)));
    const url = safeLink(event.details?.url ?? event.details?.pullRequestUrl);
    if (url) { const link = el('a', ' Open PR ↗'); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; text.append(link); }
    row.append(time, el('span', undefined, 'event-dot'), text); container.append(row);
  }
}
function renderHistory(project, sessions) {
  $('session-count').textContent = `${sessions.length} SESSION${sessions.length === 1 ? '' : 'S'}`;
  const body = $('session-history'); body.replaceChildren();
  if (!sessions.length) { const row = el('tr'); const cell = el('td', 'No instrumented sessions have been recorded for this project.', 'table-empty'); cell.colSpan = 6; row.append(cell); body.append(row); }
  for (const session of sessions.slice(0, 30)) {
    const m = session.metrics ?? {}, row = el('tr');
    row.append(el('td', date(m.startedAt ?? session.startedAt)), el('td', m.status === 'stale' ? 'Heartbeat stale' : phaseNames[m.phase] ?? m.status ?? 'Unknown'), el('td', duration(m.continuousObservedMs)), el('td', duration(m.codingMs)), el('td', integer(m.prsCreated)));
    const cell = el('td'), button = el('button', session.id === sessionId ? 'Selected' : 'View session', 'view-session'); button.type = 'button'; button.setAttribute('aria-pressed', String(session.id === sessionId)); button.addEventListener('click', () => { sessionId = session.id; render(); }); cell.append(button); row.append(cell); body.append(row);
  }
  const legacy = project?.legacy;
  $('legacy-history').textContent = legacy ? `Earlier task history: ${integer(legacy.tasks)} tasks · ${integer(legacy.prCreated)} recorded PR results · ${integer(legacy.noChanges)} no-change results · ${integer(legacy.failed)} failures. These totals are not instrumented sessions and cannot prove the 25-hour goal.` : 'Earlier task history is separate from measured sessions; no historical runtime is inferred.';
}
function render() {
  const projects = data?.projects ?? [];
  if (!projects.some(project => project.id === projectId)) { projectId = projects[0]?.id; sessionId = undefined; }
  const project = projects.find(item => item.id === projectId), sessions = sessionsFor(project);
  if (!sessions.some(session => session.id === sessionId)) sessionId = sessions[0]?.id;
  const session = sessions.find(item => item.id === sessionId), m = session?.metrics;
  setOptions($('project-select'), projects.map(p => ({value:p.id,label:p.name ?? p.id})), projectId, 'No configured projects');
  setOptions($('session-select'), sessions.map(s => ({value:s.id,label:`${date(s.metrics?.startedAt ?? s.startedAt)} · ${s.metrics?.status ?? 'unknown'} · ${String(s.id).slice(0,8)}`})), sessionId, 'No instrumented sessions yet');
  const targetMs = number(m?.targetMs) || number(data?.targetHours || 25) * 3600000;
  $('target-time').textContent = `${Math.round(targetMs / 3600000)}h`;
  $('continuous-time').textContent = m ? duration(m.continuousObservedMs) : '—';
  const progress = Math.min(1, Math.max(0, number(m?.continuousObservedMs) / targetMs));
  $('goal-fill').style.width = `${progress * 100}%`;
  $('goal-progress').setAttribute('aria-valuemax', String(targetMs / 3600000)); $('goal-progress').setAttribute('aria-valuenow', String(number(m?.continuousObservedMs) / 3600000));
  $('goal-progress').setAttribute('aria-valuetext', m ? `${duration(m.continuousObservedMs)} of ${duration(targetMs)} continuously observed` : 'No measured session yet');
  if (!m || m.status === 'no_evidence') {
    badge($('goal-verdict'), 'Not measured yet');
    $('goal-explanation').textContent = 'A 25-hour claim needs an instrumented session with regular heartbeats. Start the updated runner for the next session; let any current task finish before restarting. Earlier task results do not establish session duration.';
  } else if (m.reachedRuntimeTarget) {
    badge($('goal-verdict'), number(m.codingMs) > 0 ? 'Runtime target reached' : 'Runtime only · no coding', m.reachedCodingTarget && !number(m.interventions) ? 'success' : 'warning');
    $('goal-explanation').textContent = `This session has a continuously observed ${duration(m.continuousObservedMs)} span. Coding accounts for ${duration(m.codingMs)}; waiting accounts for ${duration(m.waitingMs)}. Recorded external interruptions/edits: ${integer(m.interventions)}. Runtime alone does not verify productive autonomy or acceptance.`;
  } else {
    badge($('goal-verdict'), m.status === 'stale' ? 'Heartbeat stale' : m.status === 'stopped' ? 'Session ended below target' : m.phase === 'waiting' ? 'Waiting · goal not reached' : 'Measuring · below 25h', ['stale','stopped'].includes(m.status) ? 'warning' : 'live');
    $('goal-explanation').textContent = `${duration(Math.max(0,targetMs-number(m.continuousObservedMs)))} remains to the continuous runtime target. ${number(m.gaps) ? `${integer(m.gaps)} observation gap${m.gaps === 1 ? '' : 's'} break continuity. ` : ''}Read the activity breakdown and PR outcomes before judging the run useful.`;
  }
  $('session-start').textContent = m ? `Started ${date(m.startedAt)} · session ${String(session.id).slice(0,8)}` : 'No instrumented session selected';
  $('current-span').textContent = `Current span: ${duration(m?.currentContinuousObservedMs)} · coding target: ${duration(m?.codingMs)} / ${Math.round(targetMs / 3600000)}h`;
  for (const [id,key] of [['coding-time','codingMs'],['publishing-time','publishingMs'],['waiting-time','waitingMs'],['unknown-time','unknownMs']]) $(id).textContent = duration(m?.[key]);
  $('utilization').textContent = `Coding utilization ${m ? `${Math.round(Math.max(0,Math.min(1,number(m.utilization))) * 100)}%` : '—'}`;
  $('pr-count').textContent = m ? integer(m.prsCreated) : '—'; $('finished-count').textContent = m ? integer(m.tasksFinished) : '—'; $('failure-count').textContent = m ? `${integer(m.failed)} / ${integer(m.noChanges)}` : '—';
  $('output-note').textContent = m ? `New PR receipts only; imported history excluded.${number(m.codingMs) > 0 ? ` ${number(m.prRatePerCodingHour).toFixed(2)} PRs per coding hour.` : ''} Publication failures: ${integer(m.publicationFailures)}. A draft PR is not acceptance.` : 'New PR receipts only. Imported history is excluded. A draft PR is not acceptance.';
  renderTimeline(m); queue(project); renderEvents(session); renderHistory(project,sessions);
  const current = project?.currentTask;
  const selectedIsLatest = sessions[0]?.id === sessionId;
  const observedTask = current && (!session || selectedIsLatest) ? current : null;
  badge($('phase-badge'), m?.status === 'stale' ? 'Stale' : phaseNames[m?.phase] ?? (observedTask ? 'Legacy task state' : 'Unknown'), m?.status === 'stale' ? 'warning' : ['working','publishing'].includes(m?.phase) ? 'live' : 'neutral');
  $('current-task').textContent = observedTask?.id ?? (m ? phaseNames[m.phase] ?? 'Session activity' : 'Waiting for session evidence');
  $('current-description').textContent = observedTask ? `${observedTask.status ?? 'Working'}${observedTask.startedAt ? ` since ${date(observedTask.startedAt)}` : ''}.${m && observedTask.sessionId === session?.id ? '' : ' This task has no measured session yet; its runtime is not inferred.'}` : m ? (m.status === 'stale' ? 'The last heartbeat is too old to confirm the runner is still active. Missing time is not credited.' : m.status === 'stopped' ? `Recorded session ended${m.endedAt ? ` ${date(m.endedAt)}` : ''}. Inspect its last events for the stop reason.` : m.phase === 'waiting' ? 'The runner is available but has no task running. Check runnable work, holds and prior review results.' : `Last observed ${phaseNames[m.phase]?.toLowerCase() ?? m.phase}. The event list records task transitions and publication outcomes.`) : 'Start or restart the updated runner to record its next session. Legacy task state may still be available below.';
  $('intervention-count').textContent = m ? integer(m.interventions) : '—';
  const download = $('download-log');
  if (project && session) { download.href = `/api/mini-symphony/log?project=${encodeURIComponent(project.id)}&session=${encodeURIComponent(session.id)}`; download.classList.remove('disabled'); download.removeAttribute('aria-disabled'); download.removeAttribute('tabindex'); download.setAttribute('download', `mini-symphony-${String(session.id).slice(0,8)}.log`); }
  else { download.removeAttribute('href'); download.classList.add('disabled'); download.setAttribute('aria-disabled','true'); download.tabIndex = -1; }
  const stale = m?.status === 'stale'; $('freshness-dot').className = `freshness-dot ${stale ? 'stale' : lastFetch ? 'fresh' : ''}`;
  $('freshness').textContent = stale ? 'Runner heartbeat stale' : m?.lastSeenAt ? `Last observed ${date(m.lastSeenAt)}` : 'Connected · no session evidence';
  $('last-updated').textContent = `Dashboard updated ${date(data.generatedAt ?? new Date(lastFetch).toISOString())} · refreshes every 5s`;
  if (project?.error) notice(String(project.error)); else if (!projects.length) notice('No runner sources are configured. Add local project sources to the server configuration to measure sessions.'); else if (data.error) notice(String(data.error)); else notice('');
}
async function refresh() {
  if (fetching) return; fetching = true; $('refresh-button').disabled = true;
  try {
    const response = await fetch('/api/mini-symphony', {cache:'no-store',signal:AbortSignal.timeout(10000)});
    if (!response.ok) throw Error(response.status === 403 ? 'This operational dashboard is available only from an authorized local connection.' : `Dashboard evidence request failed (${response.status}).`);
    const next = await response.json(); if (!Array.isArray(next.projects)) throw Error('The server returned an invalid evidence response.');
    data = next; lastFetch = Date.now(); render();
  } catch (error) { notice(`${error.message ?? 'Could not refresh runner evidence.'} ${data ? 'The last successful snapshot is still shown.' : 'No live measurements are shown.'}`); $('freshness').textContent = 'Evidence connection unavailable'; $('freshness-dot').className = 'freshness-dot stale'; }
  finally { fetching = false; $('refresh-button').disabled = false; }
}
$('refresh-button').addEventListener('click',refresh);
$('project-select').addEventListener('change',event=>{projectId=event.target.value;sessionId=undefined;render();});
$('session-select').addEventListener('change',event=>{sessionId=event.target.value;render();});
$('show-heartbeats').addEventListener('change',()=>{if(data)render();});
for(const link of document.querySelectorAll('.nav-link'))link.addEventListener('click',()=>{for(const other of document.querySelectorAll('.nav-link'))other.classList.toggle('selected',other===link);});
setInterval(()=>{if(!document.hidden)void refresh();},5000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
void refresh();
