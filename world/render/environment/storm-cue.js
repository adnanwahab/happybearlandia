// Sound is opt-in; reduced motion suppresses the onset flash and thunder.
export function mountStormCue(container=document.body) {
  const button=document.createElement('button');
  button.type='button'; button.textContent='Storm sound: muted'; button.dataset.testid='storm-mute';
  button.setAttribute('aria-pressed','true');
  container.append(button);
  const flash=document.createElement('div');
  flash.style.cssText='position:fixed;inset:0;background:#e5efff;opacity:0;pointer-events:none;z-index:5';
  flash.dataset.testid='storm-lightning';document.body.append(flash);
  let muted=true, audio=null, animation=null;
  button.onclick=()=>{muted=!muted;button.textContent=`Storm sound: ${muted?'muted':'on'}`;button.setAttribute('aria-pressed',String(muted));if(muted)void audio?.suspend();else {const Audio=globalThis.AudioContext??globalThis.webkitAudioContext;if(Audio){audio??=new Audio();void audio.resume().catch(()=>{});}}};
  return {onset(){
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    animation?.cancel();animation=flash.animate([{opacity:0},{opacity:.5,offset:.15},{opacity:0}],{duration:280});
    if(muted||!audio||audio.state!=='running')return;
    const seconds=1.5, buffer=audio.createBuffer(1,Math.floor(audio.sampleRate*seconds),audio.sampleRate),data=buffer.getChannelData(0);
    // Deterministic noise for a low-pass thunder rumble, independent of model RNG.
    let value=12345;for(let i=0;i<data.length;i++){value=(Math.imul(value,1664525)+1013904223)>>>0;data[i]=(value/2147483648-1)*(1-i/data.length);}
    const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain();source.buffer=buffer;filter.type='lowpass';filter.frequency.value=180;gain.gain.value=.25;source.connect(filter).connect(gain).connect(audio.destination);source.start(audio.currentTime+.2);
  },dispose(){animation?.cancel();button.remove();flash.remove();void audio?.close();}};
}
