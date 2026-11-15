import {createMediaPreferences} from '../../../shared/media/preferences.js';

// Editorial display scales, not significance thresholds or welfare judgments.
const categories={housingUnits:['Homes',220,24],meanRent:['Whole-stock rent',330,1000],capitalSpending:['Capital spending',440,1000000]};
export function deltaCue(key,metric){
  const category=categories[key];
  if(!category || metric?.available===false || ![metric?.baseline,metric?.plan,metric?.delta].every(Number.isFinite) || metric.delta!==metric.plan-metric.baseline)return null;
  const [label,frequency,scale]=category,ratio=Math.min(1,Math.abs(metric.delta)/scale);
  if(metric.delta===0)return {caption:`${label}: no recorded difference; silent.`,silent:true};
  const band=ratio<.25?'small':ratio<.75?'medium':'large';
  return {frequency,endFrequency:frequency*(metric.delta>0?1.125:1/1.125),duration:{small:.12,medium:.22,large:.32}[band],caption:`${label}: ${metric.delta} ${metric.unit??''}; ${band} cue, ${metric.delta>0?'rising':'falling'} pitch. Synthetic model difference; no benefit or certainty implied.`};
}

export function createCuePlayer({createContext=()=>new (globalThis.AudioContext||globalThis.webkitAudioContext)()}={}){
  let context=null,voice=null,generation=0,disposed=false;
  function stop(){generation++;if(voice){try{voice.osc.stop();}catch{}voice.osc.disconnect();voice.gain.disconnect();voice=null;}}
  return {stop,async play(cue,volume){
    stop();if(disposed||!cue||cue.silent||!Number.isFinite(volume)||volume<=0)return false;
    const token=generation;
    try{
      context??=createContext();await context.resume();
      if(disposed||token!==generation||context.state!=='running')return false;
      const osc=context.createOscillator(),gain=context.createGain(),now=context.currentTime;
      voice={osc,gain};osc.type='sine';osc.frequency.setValueAtTime(cue.frequency,now);osc.frequency.linearRampToValueAtTime(cue.endFrequency,now+cue.duration);
      gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.035*Math.min(1,volume),now+.025);gain.gain.linearRampToValueAtTime(0,now+cue.duration);
      osc.connect(gain);gain.connect(context.destination);osc.onended=()=>{osc.disconnect();gain.disconnect();if(voice?.osc===osc)voice=null;};osc.start();osc.stop(now+cue.duration);return true;
    }catch{stop();return false;}
  },dispose(){if(disposed)return;disposed=true;stop();try{context?.close()?.catch(()=>{});}catch{}context=null;}};
}

export function mountSonicControls(shell){
  const doc=shell.ownerDocument,win=doc.defaultView,preferences=createMediaPreferences(win),player=createCuePlayer();
  const panel=doc.createElement('section');panel.className='fm-story';panel.setAttribute('aria-label','Optional sonic differences');
  panel.innerHTML='<h2>Optional sonic differences</h2><label>Difference category <select aria-label="Sonic difference category"><option value="housingUnits">Homes</option><option value="meanRent">Whole-stock rent</option><option value="capitalSpending">Capital spending</option></select></label> <label>Sound volume <input aria-label="Sound volume" type="range" min="0" max="1" step="0.05" value="0"></label> <button type="button">Hear selected difference</button><p>Cosmetic sonification: homes 220 Hz, rent 330 Hz, spending 440 Hz. Rising/falling pitch means positive/negative delta. Small/medium/large durations: 120/220/320 ms at below 25%/75%/otherwise of 24 homes, 1,000 USD/month rent or 1,000,000 USD spending. Volume stays capped; these editorial scales do not measure importance. Zero is silent. Navigation never triggers sound.</p><p role="status"></p>';
  shell.querySelector('.fm-metrics').after(panel);
  const select=panel.querySelector('select'),volume=panel.querySelector('input'),button=panel.querySelector('button'),caption=panel.querySelector('[role=status]');
  let current={},cue=null,version=0;
  const refresh=()=>{version++;player.stop();cue=current.status==='ready'&&!current.preview&&!current.error&&current.diff?.available===true?deltaCue(select.value,current.diff.metrics?.[select.value]):null;button.disabled=!cue||cue.silent||preferences.get().volume===0;caption.textContent=(cue?.caption??'No supported recorded difference available; silent.')+(preferences.get().volume===0?' Sound muted.':'');};
  const unsubscribe=preferences.subscribe(state=>{volume.value=state.volume;refresh();});
  volume.oninput=()=>preferences.set({volume:Number(volume.value)});select.onchange=refresh;
  button.onclick=async()=>{const token=version;const played=await player.play(cue,preferences.get().volume);if(token===version&&!played)caption.textContent='Audio unavailable or muted; no cue played. '+(cue?.caption??'');};
  const hide=()=>{version++;player.dispose();};win.addEventListener('pagehide',hide);
  return {update(state){current=state;refresh();},dispose(){version++;unsubscribe();preferences.dispose();player.dispose();win.removeEventListener('pagehide',hide);volume.oninput=select.onchange=button.onclick=null;panel.remove();}};
}
