import { hasSessionConsent, setSessionConsent, readSessions, SESSION_LOG_KEY, sessionFrameAt } from './session-log.js';
const $ = id => document.getElementById(id);
let storage;
try { storage = localStorage; } catch { /* Private/blocked storage is handled below. */ }
let selected = null, playing = false, animation = null, previous = null;
const status = text => { $('status').textContent = text; };
const seconds = n => `${(n / 1000).toFixed(1)}s`;
function stop() { playing = false; previous = null; cancelAnimationFrame(animation); $('play').textContent = 'Play'; }
function render() {
  if (!selected) return;
  const at = Number($('scrubber').value), { sample, recent } = sessionFrameAt(selected, at);
  $('time').textContent = seconds(at);
  $('facts').textContent = sample ? `Simulation ${sample.mode} · minute ${sample.minute ?? 'unavailable'} · seed ${sample.seed ?? 'unavailable'} · ${sample.fps ?? '—'} FPS · slowest sampled frame ${sample.maxFrameMs ?? '—'}ms` : 'No state sample at this time.';
  $('events').replaceChildren(...recent.map(event => {
    const li = document.createElement('li');
    li.textContent = `${seconds(event.at)} · ${event.type}${event.kind ? ` · ${event.kind}` : ''}`;
    return li;
  }));
  const canvas = $('replay'), ctx = canvas.getContext('2d');
  ctx.fillStyle = '#10171e'; ctx.fillRect(0, 0, 800, 320);
  ctx.fillStyle = '#b7c1ca'; ctx.font = '15px system-ui'; ctx.fillText('Recorded camera path (relative scene coordinates)', 20, 28);
  const samples = selected.events.filter(e => e.type === 'sample' && e.camera);
  if (samples.length) {
    const xs = samples.map(e => e.camera[0]), zs = samples.map(e => e.camera[2]);
    const minX = Math.min(...xs), minZ = Math.min(...zs), width = Math.max(10, Math.max(...xs) - minX), depth = Math.max(10, Math.max(...zs) - minZ);
    const point = e => [30 + (e.camera[0] - minX) / width * 740, 65 + (e.camera[2] - minZ) / depth * 200];
    const visible = samples.filter(e => e.at <= at);
    ctx.beginPath(); visible.forEach((e, i) => { const [x, y] = point(e); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.strokeStyle = '#86baf1'; ctx.lineWidth = 3; ctx.stroke();
    if (visible.length) { const [x, y] = point(visible.at(-1)); ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fillStyle = '#e5efff'; ctx.fill(); }
  } else { ctx.fillText('Camera state unavailable in this session.', 20, 90); }
  for (const e of recent.filter(e => e.type === 'click' && e.x !== null && e.y !== null && at - e.at <= 1500)) {
    ctx.beginPath(); ctx.arc(e.x * 800, e.y * 320, 12, 0, Math.PI * 2); ctx.strokeStyle = '#ffe09b'; ctx.lineWidth = 3; ctx.stroke();
  }
  ctx.fillStyle = '#b7c1ca'; ctx.fillText('Gold rings: coarse click positions on the original screen', 20, 305);
}
function select(session) {
  stop(); selected = session; $('player').hidden = false;
  $('scrubber').max = Math.max(1, session.events.at(-1)?.at ?? 0); $('scrubber').value = 0;
  render();
}
function refresh() {
  stop(); selected = null; $('player').hidden = true;
  $('consent').checked = hasSessionConsent(storage);
  const sessions = readSessions(storage);
  $('sessions').replaceChildren();
  if (!sessions.length) $('sessions').textContent = 'No sessions saved. Enable optional recording, visit World, then return here.';
  for (const session of [...sessions].reverse()) {
    const button = document.createElement('button'); button.type = 'button';
    button.textContent = `${new Date(session.startedAt).toLocaleString()} · ${seconds(session.events.at(-1)?.at ?? 0)} · ${session.events.length} events`;
    button.onclick = () => select(session); $('sessions').append(button);
  }
}
$('consent').onchange = () => { const enabled = $('consent').checked; const ok = setSessionConsent(storage, enabled); refresh(); status(ok ? enabled ? 'Recording enabled for World. Logs stay in this browser.' : 'Recording stopped and sessions deleted.' : 'Browser storage unavailable. Nothing was saved.'); };
$('delete').onclick = () => { try { storage.removeItem(SESSION_LOG_KEY); refresh(); status('Sessions deleted. Recording preference unchanged.'); } catch { status('Browser storage unavailable.'); } };
$('scrubber').oninput = () => { stop(); render(); };
$('play').onclick = () => {
  if (playing) { stop(); return; }
  if (Number($('scrubber').value) >= Number($('scrubber').max)) $('scrubber').value = 0;
  playing = true; $('play').textContent = 'Pause';
  function tick(at) {
    if (!playing) return;
    if (previous !== null) $('scrubber').value = Math.min(Number($('scrubber').max), Number($('scrubber').value) + at - previous);
    previous = at; render();
    if (Number($('scrubber').value) >= Number($('scrubber').max)) stop(); else animation = requestAnimationFrame(tick);
  }
  animation = requestAnimationFrame(tick);
};
addEventListener('storage', refresh);
document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
refresh();
if (!storage) status('Browser storage unavailable. Recording is disabled.');
