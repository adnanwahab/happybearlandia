import * as THREE from 'three/webgpu';
import {roadFrame} from '../columns-demo/frame.js';
import {mountParticles} from '../particles.js';
const view=document.querySelector('#view'),status=document.querySelector('#status'),slider=document.querySelector('#time'),pause=document.querySelector('#pause'),toggle=document.querySelector('#toggle');
const diagnostic=window.particlesDiagnostic={ready:false,errors:[],timings:[]};
let renderer,layer,observer,raf,disposed=false,playing=false,seconds=0,previous=0;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
function dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(raf);observer?.disconnect();layer?.dispose();renderer?.dispose();}
diagnostic.dispose=dispose;
try{
 if(new URLSearchParams(location.search).has('noGPU')||!navigator.gpu)throw Error('WebGPU unavailable');
 const adapter=await navigator.gpu.requestAdapter();if(!adapter||adapter.info.isFallbackAdapter)throw Error('Nonfallback adapter unavailable');
 diagnostic.adapter=Object.fromEntries(['vendor','architecture','description','isFallbackAdapter'].map(k=>[k,adapter.info[k]]));
 renderer=new THREE.WebGPURenderer({antialias:true});await renderer.init();if(!renderer.backend.isWebGPUBackend)throw Error('Native backend unavailable');
 renderer.backend.device.addEventListener('uncapturederror',e=>diagnostic.errors.push(e.error.message));
 renderer.backend.device.lost.then(()=>{if(disposed)return;dispose();diagnostic.ready=false;status.textContent='Device lost. Reload to recover.';pause.disabled=toggle.disabled=slider.disabled=true;});
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(48,1,1,6000);camera.position.set(1100,1000,1300);camera.lookAt(0,0,0);
 renderer.setClearColor(0x172630);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
 const frame=roadFrame(0);layer=mountParticles({scene,renderer,frame,metricId:frame.metrics[0].id,reducedMotion});if(!await layer.ready)throw Error('Layer unavailable');
 Object.assign(diagnostic,{renderer,scene,camera,layer});view.replaceChildren(renderer.domElement);
 function draw(){layer.setTime(seconds);renderer.render(scene,camera);status.textContent=`Native WebGPU · ${layer.stats().count} lights · ${layer.stats().drawCalls} draw · ${layer.stats().allocatedBufferBytes} allocated attribute bytes · cosmetic ${seconds.toFixed(1)}s`;}
 const resize=()=>{renderer.setSize(view.clientWidth,view.clientHeight);camera.aspect=view.clientWidth/view.clientHeight;camera.updateProjectionMatrix();draw();};observer=new ResizeObserver(resize);observer.observe(view);resize();
 slider.oninput=()=>{seconds=Number(slider.value);draw();};toggle.onclick=()=>{const enabled=layer.stats().state==='disabled';layer.setEnabled(enabled);toggle.textContent=enabled?'Hide particles':'Show particles';draw();};
 pause.disabled=reducedMotion;pause.onclick=()=>{playing=!playing;pause.textContent=playing?'Pause cosmetic pulse':'Play cosmetic pulse';};
 function tick(now){if(disposed)return;if(playing&&!reducedMotion){seconds=(seconds+Math.min((now-previous)/1000,.1))%12;slider.value=seconds;const start=performance.now();draw();if(diagnostic.timings.length<1200)diagnostic.timings.push(performance.now()-start);}previous=now;raf=requestAnimationFrame(tick);}raf=requestAnimationFrame(tick);
 await renderer.renderAsync(scene,camera);diagnostic.ready=true;
}catch(error){dispose();view.textContent='Graphics unavailable. Synthetic demonstration only; no measurements or model results.';status.textContent=error.message+' · GPU performance NOT RUN';pause.disabled=toggle.disabled=slider.disabled=true;diagnostic.unavailable=true;}
addEventListener('pagehide',dispose,{once:true});
