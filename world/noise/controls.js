import {createAmbientMixer} from '../ambient/mixer.js';
import {proximity} from './model.js';
export function mountNoisePlayground(win, document, host) {
  const panel=document.createElement('fieldset');
  const legend=document.createElement('legend');legend.textContent='Urban Noise Playground';
  const label=document.createElement('label'), toggle=document.createElement('input');toggle.type='checkbox';
  label.append(toggle,' Enable illustrative traffic');
  const note=document.createElement('p');note.textContent='Illustrative sound design • synthetic road demo, not measured environmental noise. No decibel measurements. Move the view near the authored roads: z=0 or x=80 (−200 to 200 world units). No voice or music.';
  const status=document.createElement('p');status.setAttribute('role','status');
  panel.append(legend,label,note,status);host.append(panel);
  const mixer=createAmbientMixer({createContext:()=>new (win.AudioContext??win.webkitAudioContext)()});
  let disposed=false, revision=0, sample=null, volume=.15, available=true, lastText='';
  function apply(){
    mixer.volume(volume);
    mixer.update(sample?{environment:'avenue',night:false,pan:0,strength:sample.strength}:null);
    const text=!available?'Audio unavailable; explore silently.':!sample?'Position or source data unavailable; silent.':`${toggle.checked?'On':'Off'} • synthetic proximity strength ${sample.strength.toFixed(2)} / 1 (not a measurement). Sound control capped at 15% (device loudness varies).`;
    if(text!==lastText){status.textContent=text;lastText=text;}
  }
  toggle.onchange=async()=>{const current=++revision,wanted=toggle.checked;const active=await mixer.enable(wanted);if(disposed||current!==revision)return;toggle.checked=active;if(wanted&&!active)available=false;apply();};
  const hidden=()=>mixer.hidden(document.hidden);document.addEventListener('visibilitychange',hidden);hidden();apply();
  return {update(listener){sample=proximity(listener);apply();},volume(value){volume=Number.isFinite(value)?Math.min(.15,Math.max(0,value)):0;apply();},dispose(){if(disposed)return;disposed=true;revision++;mixer.dispose();document.removeEventListener('visibilitychange',hidden);panel.remove();}};
}
