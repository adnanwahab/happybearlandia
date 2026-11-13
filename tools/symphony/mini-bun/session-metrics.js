const HOUR = 60 * 60 * 1000;
const PHASES = new Set(['starting', 'working', 'publishing', 'waiting', 'syncing', 'stopping', 'stopped', 'error']);
const validMs = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const githubPr = value => typeof value === 'string' && /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/\d+$/.test(value);

/** Pure reduction of one append-ordered session log. No duration is inferred from
 * an old task state, a process PID, wall-clock age, or the absence of an exit. */
export function summarizeSession(events, { now = Date.now(), heartbeatMaxGapMs = 60000, targetMs = 25 * HOUR } = {}) {
  if (!validMs(heartbeatMaxGapMs) || !heartbeatMaxGapMs) heartbeatMaxGapMs = 60000;
  if (!validMs(targetMs) || !targetMs) targetMs = 25 * HOUR;
  const result = {
    schemaVersion: 1, sessionId: null, startedAt: null, lastSeenAt: null, endedAt: null,
    status: 'no_evidence', phase: 'unknown', targetMs, elapsedMs: 0,
    continuousObservedMs: 0, currentContinuousObservedMs: 0, observedMs: 0,
    codingMs: 0, publishingMs: 0, waitingMs: 0, syncingMs: 0,
    otherObservedMs: 0, unknownMs: 0, reachedRuntimeTarget: false, reachedCodingTarget: false,
    hasStart: false, hasStop: false, tasksStarted: 0, tasksFinished: 0,
    failed: 0, noChanges: 0, prsCreated: 0, publicationFailures: 0, interventions: 0,
    utilization: 0, prRatePerCodingHour: null, outcomes: [], timeline: [], gaps: 0,
    invalidEvents: 0, foreignEvents: 0, clockRegressions: 0,
    limits: [
      'Durations cover persisted observations only; time after the latest event is not credited.',
      'Working time includes workspace preparation and a running Codex process; it is not proof of useful edits or passing tests.',
      'A draft PR and a zero process exit are review evidence, not accepted implementation.',
      'Runtime and coding targets are separate. Waiting and publishing do not count as coding.',
      'Intervention events record external interruptions or edits, which may come from an operator or supervisor; they do not identify a human actor.',
      'Only recorded intervention events are counted; missing records do not prove that no human helped or that all external activity was observed.',
    ],
  };
  const accepted = [];
  for (let event of Array.isArray(events) ? events : []) {
    if (typeof event === 'string') {
      try { event = JSON.parse(event); } catch { result.invalidEvents++; continue; }
    }
    if (!event || event.schemaVersion !== 1 || typeof event.sessionId !== 'string' || !event.sessionId ||
        !Number.isSafeInteger(event.seq) || event.seq < 0 || !validMs(event.elapsedMs) ||
        typeof event.at !== 'string' || !Number.isFinite(Date.parse(event.at)) ||
        typeof event.type !== 'string' || !event.type) {
      result.invalidEvents++; continue;
    }
    if (!result.sessionId) result.sessionId = event.sessionId;
    if (event.sessionId !== result.sessionId) { result.foreignEvents++; continue; }
    const previous = accepted.at(-1);
    if (result.hasStop || (previous && (event.seq <= previous.seq || event.elapsedMs < previous.elapsedMs)) ||
        (event.type === 'session_started' && accepted.length > 0)) {
      result.invalidEvents++; continue;
    }
    if (previous && Date.parse(event.at) < Date.parse(previous.at)) result.clockRegressions++;
    accepted.push(event);
    if (event.type === 'session_started') { result.hasStart = true; result.startedAt = event.at; }
    if (event.type === 'session_stopped') { result.hasStop = true; result.endedAt = event.at; }
  }
  if (!accepted.length) { result.limits.push('No valid session telemetry is available. Legacy task history cannot establish a 25-hour session.'); return result; }

  function segment(phase, startMs, endMs, observed) {
    const durationMs = endMs - startMs;
    if (durationMs <= 0) return;
    const tail = result.timeline.at(-1);
    if (tail && tail.phase === phase && tail.observed === observed && tail.endMs === startMs) {
      tail.endMs = endMs; tail.durationMs += durationMs;
    } else result.timeline.push({ phase, startMs, endMs, durationMs, observed });
  }
  segment('unknown', 0, accepted[0].elapsedMs, false);
  for (let n = 1; n < accepted.length; n++) {
    const previous = accepted[n - 1], current = accepted[n];
    const duration = current.elapsedMs - previous.elapsedMs;
    // Missing sequence numbers may conceal a phase transition even if heartbeats
    // are close. The entire uncertain interval is uncredited, not guessed.
    const covered = duration <= heartbeatMaxGapMs && current.seq === previous.seq + 1;
    if (!covered) {
      segment('unknown', previous.elapsedMs, current.elapsedMs, false);
      result.currentContinuousObservedMs = 0; result.gaps++;
      continue;
    }
    const phase = PHASES.has(previous.phase) ? previous.phase : 'unknown';
    segment(phase, previous.elapsedMs, current.elapsedMs, true);
    result.observedMs += duration;
    result.currentContinuousObservedMs += duration;
    result.continuousObservedMs = Math.max(result.continuousObservedMs, result.currentContinuousObservedMs);
    if (phase === 'working') result.codingMs += duration;
    else if (phase === 'publishing') result.publishingMs += duration;
    else if (phase === 'waiting') result.waitingMs += duration;
    else if (phase === 'syncing') result.syncingMs += duration;
    else result.otherObservedMs += duration;
  }

  const starts = new Set(), finishes = new Map(), inferredAttempts = new Map(), prs = new Set();
  for (const event of accepted) {
    const details = event.details && typeof event.details === 'object' ? event.details : {};
    const taskId = typeof event.taskId === 'string' ? event.taskId : null;
    const explicitAttempt = Number.isSafeInteger(details.attempt) && details.attempt >= 0 ? details.attempt : null;
    if (event.type === 'task_started' && taskId) {
      const attempt = explicitAttempt ?? (inferredAttempts.get(taskId) ?? 0) + 1;
      inferredAttempts.set(taskId, attempt); starts.add(`${taskId}:${attempt}`);
    }
    if (event.type === 'task_finished' && taskId) {
      const attempt = explicitAttempt ?? inferredAttempts.get(taskId) ?? 0;
      const status = typeof details.status === 'string' ? details.status : details.code === 0 ? 'needs_review' : 'failed';
      const outcome = { taskId, attempt, status, at: event.at, elapsedMs: event.elapsedMs };
      if (Number.isInteger(details.code)) outcome.code = details.code;
      if (githubPr(details.url)) outcome.url = details.url;
      finishes.set(`${taskId}:${attempt}`, outcome);
    }
    if (event.type === 'pr_created' && !details.reused && !details.imported && !details.reconciled && githubPr(details.url)) prs.add(details.url);
    if (event.type === 'publish_failed') result.publicationFailures++;
    if (event.type === 'operator_intervention') result.interventions++;
  }
  const last = accepted.at(-1);
  result.elapsedMs = last.elapsedMs;
  result.lastSeenAt = last.at;
  result.phase = PHASES.has(last.phase) ? last.phase : 'unknown';
  result.unknownMs = Math.max(0, result.elapsedMs - result.observedMs);
  result.tasksStarted = starts.size;
  result.outcomes = [...finishes.values()];
  result.tasksFinished = result.outcomes.length;
  result.failed = result.outcomes.filter(o => ['failed', 'interrupted', 'timed_out', 'timeout'].includes(o.status) || (o.code !== undefined && o.code !== 0)).length;
  result.noChanges = result.outcomes.filter(o => o.status === 'no_changes').length;
  result.prsCreated = prs.size;
  result.utilization = result.observedMs ? result.codingMs / result.observedMs : 0;
  result.prRatePerCodingHour = result.codingMs > 0 ? result.prsCreated / (result.codingMs / HOUR) : null;
  result.reachedRuntimeTarget = result.hasStart && result.continuousObservedMs >= targetMs;
  result.reachedCodingTarget = result.hasStart && result.codingMs >= targetMs;
  const age = Number(now) - Date.parse(last.at);
  result.status = result.hasStop ? 'stopped' : !Number.isFinite(age) || age < 0 || age > heartbeatMaxGapMs ? 'stale' : result.phase === 'waiting' ? 'waiting' : 'running';
  if (!result.hasStart) result.limits.push('The session-start record is missing; target attainment cannot be verified from this truncated log.');
  if (result.gaps) result.limits.push('Gaps or missing sequence numbers are unobserved time and break the continuous-runtime span.');
  if (result.clockRegressions) result.limits.push('Wall-clock regression was observed; durations use recorded monotonic elapsed time, not wall-clock differences.');
  if (result.foreignEvents) result.limits.push('Events from other session IDs were excluded; restarts are never combined into one session.');
  return result;
}
