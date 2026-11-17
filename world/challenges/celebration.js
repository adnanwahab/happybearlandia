/** Decorative consumer of the challenge worker's validated replay result only. */
export function celebrationOccurrence(envelope, result) {
 if (!envelope?.id || !/^[a-f0-9]{64}$/.test(envelope.digest ?? '') ||
     result?.schemaVersion !== 'city-challenge-verification.v1' || result.challengeId !== envelope.id ||
     result.won !== true || result.status !== 'challenge-beaten') return null;
 if (!['reference','candidate'].every(role => result[role]?.initialHash === envelope.initialHash && result[role]?.seed === envelope.seed) ||
     !result.budget?.referenceWithinCap || !result.budget?.candidateWithinCap ||
     !result.guards?.length || !result.guards.every(row => row.passed === true) ||
     !result.metrics?.length || !result.metrics.every(row => row.status === 'available' && row.noWorse === true && Number.isFinite(row.delta)) ||
     !result.metrics.some(row => row.strictlyBetter === true) || !Array.isArray(result.candidate.selection)) return null;
 if (new Set(result.candidate.selection).size !== result.candidate.selection.length || result.candidate.selection.some(id => !envelope.actions?.some(action => action.id === id))) return null;
 return JSON.stringify([envelope.digest, [...result.candidate.selection].sort()]);
}

export function createCelebrationGate() {
 const seen = new Set();
 return (envelope, result) => {
  const id = celebrationOccurrence(envelope, result);
  // Fail closed at the session bound; never evict an ID and replay its burst.
  if (!id || seen.has(id) || seen.size >= 256) return false;
  seen.add(id); return true;
 };
}

export function mountChallengeCelebration(container) {
 const doc = container.ownerDocument, win = doc.defaultView;
 const root = doc.createElement('div'); root.className = 'challenge-celebration'; root.hidden = true;
 const text = doc.createElement('span'); text.setAttribute('role','status');
 text.textContent = '★ Verified local model challenge completed. Decorative stars only.';
 const skip = doc.createElement('button'); skip.type = 'button'; skip.textContent = 'Skip celebration';
 const stars = Array.from({length:7}, () => {const star=doc.createElement('span');star.textContent='✦';star.setAttribute('aria-hidden','true');star.className='challenge-star';return star;});
 root.append(text, skip, ...stars); container.append(root);
 let timer = null, animations = [], destroyed = false;
 function clear() { if(timer !== null) win.clearTimeout(timer); timer = null; for(const animation of animations) animation.cancel(); animations = []; root.hidden = true; }
 skip.onclick = clear;
 const motion = win.matchMedia?.('(prefers-reduced-motion: reduce)');
 const motionChanged = () => { for(const animation of animations) animation.cancel(); animations = []; };
 motion?.addEventListener?.('change', motionChanged);
 return {show() {
  if(destroyed) return;
  clear(); container.append(root); root.hidden = false;
  if(motion?.matches === false) stars.forEach((star,index) => {if(star.animate) animations.push(star.animate([
   {opacity:0,transform:'translate(0,0) scale(.5)'},
   {opacity:1,offset:.3},
   {opacity:0,transform:`translate(${(index-3)*12}px,-24px) scale(1)`}
  ],{duration:700,easing:'ease-out'}));});
  timer = win.setTimeout(clear, 2400);
 }, clear, destroy() { if(destroyed)return; destroyed = true; clear(); motion?.removeEventListener?.('change',motionChanged); skip.onclick = null; root.remove(); }};
}
