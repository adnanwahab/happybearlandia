import {test,expect} from 'bun:test';
import {createGameSounds} from '../world/house/sound-effects.js';
test('game sound effects require opt-in, skip historical events, deduplicate and stop on mute',async()=>{const played=[],voices=[],engine=createGameSounds({storage:null,now:()=>10000,fetchImpl:async()=>Response.json({clips:[{id:'sfx_015',ogg:'ogg/15_short_buzzy_blast.ogg',wav:'wav/15_short_buzzy_blast.wav'}]}),audioFactory:()=>{const v={volume:0,src:'',play:async()=>{played.push(v.src);},pause(){v.stopped=true;}};voices.push(v);return v;}});expect(await engine.play('sfx_015')).toBe(false);engine.observe({systems:{comedy:{moments:[{id:'old',kind:'award',minute:1}]}}});await engine.enable(true);expect(await engine.play('sfx_015')).toBe(true);expect(played).toHaveLength(1);expect(await engine.play('sfx_015')).toBe(false);await engine.enable(false);expect(voices[0].stopped).toBe(true);engine.destroy();});

test('muting during acquisition prevents a stale sound and re-enabling reuses its bounded asset',async()=>{
 let release,attempt=0;const played=[];
 const engine=createGameSounds({storage:null,fetchImpl:async url=>url.endsWith('manifest.json')?Response.json({clips:[{id:'sfx_015',ogg:'ogg/15_short_buzzy_blast.ogg'}]}):(++attempt===1?new Promise(resolve=>release=resolve):new Response(new Uint8Array(3))),audioFactory:()=>({play:async()=>played.push(true),pause(){}})});
 await engine.enable(true);const pending=engine.play('sfx_015');await Promise.resolve();await engine.enable(false);release(new Response(new Uint8Array(3)));expect(await pending).toBe(false);expect(played).toEqual([]);await engine.enable(true);expect(await engine.play('sfx_015')).toBe(true);engine.destroy();
});
