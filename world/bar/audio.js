/** Quiet, original synthesized lounge loop. Nothing plays before the sound button. */
export function createLoungeAudio() {
  let context, master, timer, enabled = false, chord = 0;
  const changes = [[130.81, 164.81, 196, 246.94], [146.83, 174.61, 220, 261.63], [123.47, 155.56, 185, 220], [130.81, 164.81, 196, 246.94]];
  function tone(frequency, start, length, volume, type = 'sine') {
    const osc = context.createOscillator(), gain = context.createGain();
    osc.type = type; osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + .025);
    gain.gain.exponentialRampToValueAtTime(.0001, start + length);
    osc.connect(gain); gain.connect(master); osc.start(start); osc.stop(start + length + .03);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
  function phrase() {
    if (!enabled || document.hidden || context.state !== 'running') return;
    const notes = changes[chord++ % changes.length], start = context.currentTime + .05;
    for (let beat = 0; beat < 8; beat++) {
      const time = start + beat * .43;
      tone(notes[beat % 2 ? 2 : 0] / 2, time, .35, .23);
      if (beat % 2 === 0) notes.forEach((note, i) => tone(note * 2, time + i * .015, .7, .045));
      if ([1, 4, 6].includes(beat)) tone(notes[(beat + chord) % 4] * 4, time + .09, .24, .038, 'triangle');
    }
  }
  async function setEnabled(next) {
    if (next && !context) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error('Audio is unavailable in this browser.');
      context = new Audio(); master = context.createGain(); master.gain.value = .15; master.connect(context.destination);
    }
    clearInterval(timer); timer = null; enabled = next;
    if (next) { await context.resume(); phrase(); timer = setInterval(phrase, 3440); }
    else if (context) await context.suspend();
    return enabled;
  }
  async function onVisibility() {
    if (!context || !enabled) return;
    if (document.hidden) { clearInterval(timer); timer = null; await context.suspend(); }
    else { await context.resume(); phrase(); timer = setInterval(phrase, 3440); }
  }
  document.addEventListener('visibilitychange', onVisibility);
  return {
    setEnabled,
    dispose() { enabled = false; clearInterval(timer); document.removeEventListener('visibilitychange', onVisibility); if (context) void context.close(); },
  };
}
