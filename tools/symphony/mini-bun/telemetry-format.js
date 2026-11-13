export function redactTelemetry(value, secrets = []) {
  let text = String(value ?? '').replace(/\x1b\[[0-9;]*m/g, '');
  for (const secret of secrets) if (typeof secret === 'string' && secret.length >= 8) text = text.split(secret).join('[redacted]');
  return text
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+(?::[^\s/@]*)?@/gi, '$1[redacted]@')
    .replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]{12,}|github_pat_[A-Za-z0-9_]{16,}|lin_api_[A-Za-z0-9_-]{12,})\b/g,'[redacted]')
    .replace(/\bBearer\s+\S+/gi,'Bearer [redacted]')
    .replace(/\b([A-Z][A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY))\s*[=:]\s*[^\s,;]+/g,'$1=[redacted]')
    .replace(/\/(?:Users|home|private|tmp)\/[^\s:;,)]*/g,'[local path]')
    .replace(/[\r\n\t]+/g,' ').slice(0,1600);
}
export function formatTelemetryLine(event) {
  const task=event.taskId ? ` [${event.taskId}]` : '';
  return `${event.at} +${(event.elapsedMs/1000).toFixed(1)}s ${event.type}${task} (${event.phase}) ${event.message ?? ''}\n`;
}
export function publicTelemetryEvent(event) {
  const allowed=['status','code','attempt','runnable','disabled','terminal','priorAttempts','running','reason','reused','timeoutMs','workers','bytes','targetHours'];
  const details={};
  for(const key of allowed) if(event.details?.[key]!==undefined) details[key]=typeof event.details[key]==='string'?redactTelemetry(event.details[key]):typeof event.details[key]==='boolean'||typeof event.details[key]==='number'?event.details[key]:null;
  if(typeof event.details?.url==='string'&&/^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+$/.test(event.details.url))details.url=event.details.url;
  return {schemaVersion:event.schemaVersion===1?1:0,sessionId:/^[0-9a-f-]{36}$/i.test(event.sessionId??'')?event.sessionId:'unknown',seq:Number.isSafeInteger(event.seq)?event.seq:-1,at:Number.isFinite(Date.parse(event.at))?new Date(event.at).toISOString():null,elapsedMs:Number.isFinite(event.elapsedMs)&&event.elapsedMs>=0?event.elapsedMs:0,type:/^[a-z_]{1,64}$/.test(event.type??'')?event.type:'invalid_event',phase:/^[a-z_]{1,32}$/.test(event.phase??'')?event.phase:'unknown',...(event.taskId?{taskId:String(event.taskId).replace(/[^A-Za-z0-9._-]/g,'').slice(0,64)}:{}),message:redactTelemetry(event.message),details};
}
