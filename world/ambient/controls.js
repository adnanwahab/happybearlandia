import {createMediaPreferences,mountMediaControls} from '../../shared/media/preferences.js';
import {mountNoisePlayground} from '../noise/controls.js';
import {ambientScene,createAmbientMixer} from './mixer.js';

export function mountAmbientSound(window, document) {
  const preferences = createMediaPreferences(window), mixer = createAmbientMixer();
  const removeControls = mountMediaControls(document, preferences);
  const panel = document.createElement('details'); panel.id = 'ambient-sound';
  panel.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:1001;background:#142033;color:white;padding:10px;border-radius:8px;max-width:calc(100vw - 24px);max-height:50vh;overflow:auto;box-sizing:border-box;font:14px sans-serif';
  const summary = document.createElement('summary'); summary.textContent = 'Ambient sound'; summary.style.minHeight = '24px';
  const input = document.createElement('input'); input.type = 'checkbox'; input.style.cssText = 'min-width:24px;min-height:24px';
  const label = document.createElement('label'); label.append(input, ' Enable cosmetic ambience');
  const status = document.createElement('p'); status.textContent = 'Synthesized scene mood, not measured sound. Uses Sound volume. Off on every visit.';
  panel.append(summary,label,status); document.body.append(panel);
  const sharedPanel = document.querySelector('[aria-label="Motion and sound settings"]');
  sharedPanel.style.cssText = 'display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-top:12px';
  panel.append(sharedPanel);
  const noise = mountNoisePlayground(window, document, panel);
  let disposed = false, revision = 0;
  input.onchange = async () => {
    const current = ++revision, wanted = input.checked;
    preferences.set({ambientSound:wanted});
    const active = await mixer.enable(wanted);
    if (!disposed && revision === current) {
      input.checked = active;
      if (wanted && !active) status.textContent = 'Ambient audio unavailable. Gameplay continues silently.';
    }
  };
  const unsubscribe = preferences.subscribe(state => {mixer.volume(state.ambientSound ? state.volume : 0);noise.volume(state.volume);});
  const visibility = () => mixer.hidden(document.hidden);
  document.addEventListener('visibilitychange', visibility); visibility();
  return {update(value) {if (!disposed) {mixer.update(ambientScene(value));noise.update(value?.target);}}, dispose() {
    if (disposed) return; disposed = true; revision++; noise.dispose(); mixer.dispose(); unsubscribe(); preferences.dispose(); removeControls(); panel.remove(); document.removeEventListener('visibilitychange',visibility);
  }};
}
