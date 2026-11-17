import { createMediaPipeline } from '../../shared/media/pipeline.js';
import { createMediaPreferences, mountMediaControls } from '../../shared/media/preferences.js';
const ROOT='/world/audio/goofy/';
/** One voice, opt-in sound cues. Audio never changes simulation state. */
export function createGameSounds({fetchImpl=fetch,audioFactory=()=>new Audio(),storage=globalThis.localStorage,now=()=>performance.now()}={}){
 const pipeline=createMediaPipeline({fetchImpl}),urls=new Map();
 let generation=0;
 let enabled=false,volume=.2,manifest=null,voice=null,last=-Infinity,destroyed=false,initialized=false;const seen=new Set();
 async function load(){if(manifest)return manifest;const response=await fetchImpl(ROOT+'manifest.json');if(!response.ok)throw Error('Sound pack could not load.');const data=await response.json();manifest=new Map(data.clips.filter(c=>/^sfx_\d{3}$/.test(c.id)&&/^ogg\/[a-z0-9_]+\.ogg$/.test(c.ogg)).map(c=>[c.id,c]));return manifest;}
 async function source(path,type){if(urls.has(path))return urls.get(path);const data=await pipeline.load(path,'audio',ROOT+path);if(destroyed)throw Error('Sound engine disposed');if(urls.has(path))return urls.get(path);const url=URL.createObjectURL(new Blob([data],{type}));urls.set(path,url);return url;}
 async function play(id,{preview=false}={}){
  if(!enabled||destroyed||!volume||(!preview&&now()-last<3000))return false;
  const request=++generation,clip=(await load()).get(id);if(!clip)throw Error('Unknown sound effect.');
  const current=()=>enabled&&!destroyed&&volume>0&&request===generation;
  const src=await source(clip.ogg,'audio/ogg');if(!current())return false;
  voice?.pause();const active=audioFactory();voice=active;active.volume=volume;active.src=src;
  try{await active.play();}catch(error){
   if(!current())return false;
   if(clip.wav&&/^wav\/[a-z0-9_]+\.wav$/.test(clip.wav)){const fallback=await source(clip.wav,'audio/wav');if(!current())return false;active.src=fallback;await active.play();}else throw error;
  }
  if(!current()){active.pause();return false;}last=now();return true;
 }

 return{async enable(value){enabled=!!value;try{storage?.setItem('hbl-game-sounds',String(enabled));}catch{}if(!enabled){generation++;voice?.pause();}else await load();return enabled;},get enabled(){return enabled;},setVolume(value){volume=Math.max(0,Math.min(1,Number(value)||0));if(voice)voice.volume=volume;if(!volume){generation++;voice?.pause();}},play,observe(home){const rows=[...(home?.systems?.comedy?.moments??[]),...(home?.systems?.comedy?.voiceRows??[])].sort((a,b)=>a.minute-b.minute);const fresh=rows.filter(e=>!seen.has(e.id));for(const row of rows)seen.add(row.id);while(seen.size>64)seen.delete(seen.values().next().value);if(!initialized){initialized=true;return;}const event=fresh.at(-1);if(event)void play(({dinner:'sfx_001',chair:'sfx_011',award:'sfx_015',prank:'sfx_010',repair:'sfx_007',compliment:'sfx_016',snack:'sfx_002'})[event.kind]??'sfx_015').catch(()=>{});},destroy(){destroyed=true;generation++;voice?.pause();pipeline.dispose();for(const url of urls.values())URL.revokeObjectURL(url);urls.clear();seen.clear();}};
}
export function mountHouseSounds(container){const doc=container.ownerDocument,engine=createGameSounds({storage:doc.defaultView.localStorage}),nav=container.querySelector('.house-top-actions')??container,button=doc.createElement('button'),link=doc.createElement('a');button.type='button';button.textContent='Sound: Off';button.setAttribute('aria-pressed','false');button.title='Enable gentle sound effects for new household moments';link.textContent='Soundboard';link.href='/world/soundboard.html';link.className='house-saved-link';nav.append(button,link);const preferences=createMediaPreferences(doc.defaultView),removeControls=mountMediaControls(doc,preferences);const unsubscribe=preferences.subscribe(({volume})=>{engine.setVolume(volume);void engine.enable(volume>0).catch(()=>{});button.textContent=volume?'Sound: On':'Sound: Off';button.setAttribute('aria-pressed',String(volume>0));});button.onclick=async()=>{try{preferences.set({volume:engine.enabled?0:.2});await engine.enable(preferences.get().volume>0);button.textContent=engine.enabled?'Sound: On':'Sound: Off';button.setAttribute('aria-pressed',String(engine.enabled));if(engine.enabled)await engine.play('sfx_011',{preview:true});}catch{button.textContent='Sound unavailable';button.title='Open the soundboard to try the audio files.';}};return{observe:home=>{if(!doc.hidden)engine.observe(home);},destroy(){unsubscribe();removeControls();preferences.dispose();engine.destroy();button.remove();link.remove();}};}
