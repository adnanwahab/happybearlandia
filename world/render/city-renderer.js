import * as THREE from 'three';
import { DetailAssetLibrary } from './assets/instanced-glb.js';
import { createGrass } from './vegetation/grass.js';
import { createCitySky } from './environment/sky.js';
import { GeometryDebug } from './geometry/debug/geometry-debug.js';
import { GeometryDetailManager } from './geometry/geometry-detail-manager.js';
import { ConstructionRenderer } from './buildings/construction-renderer.js';
import { createEnvironmentLight } from './environment/environment-light.js';
import { scriptedCamera } from './bench/scenes.js';
import { QualityManager, PRESETS } from './renderer/quality-manager.js';
import { RenderStats } from './renderer/render-stats.js';
import { GPUProfiler } from './renderer/gpu-profiler.js';
import { CityVisibility } from './city/visibility.js';
import { BuildingLOD } from './city/lod-manager.js';
import { BuildingCutaway } from './buildings/cutaway.js';
import { createCityDetails } from './environment/city-details.js';

export function mountCityRenderer({renderer,mode,scene,camera,controls,town,sun,facades=[],geometryCache,embed=false}) {
  const params=new URLSearchParams(location.search), quality=new QualityManager(params.get('quality')?.toUpperCase() in PRESETS?params.get('quality').toUpperCase():'BALANCED');
  const stats=new RenderStats(), gpu=new GPUProfiler(renderer), visibility=new CityVisibility(town.buildings), details=createCityDetails(scene,town);
  const geometryDebug=new GeometryDebug(town.buildings), geometryDetail=geometryCache?new GeometryDetailManager(town.buildings,geometryCache):null;
  const grass=createGrass(scene,town),detailAssets=new DetailAssetLibrary(scene);
  const environment=createEnvironmentLight(renderer,scene);
  const skyDome=createCitySky(scene);
  const construction=new ConstructionRenderer(scene);
  const lod=new BuildingLOD(scene,visibility.chunks), cutaway=new BuildingCutaway(scene);
  const features={assets:true,grass:true,sky:true,environment:true,construction:true,lod:true,props:true,roads:true,traffic:true,vegetation:true,roofs:true,rain:true,facades:true,interiors:true,atmosphere:true,shadows:!embed,culling:true};
  const fog=new THREE.FogExp2(0x91afbf,.00023);
  let renderInstances=0,adaptiveEnabled=true;
  let state={timeOfDay:14},lastSettings='',lastOverlay=0,frameIndex=0,active=true,photoPreset=null,focus=null,visible={},cached={},disposed=false, benchmarkStart=null;
  const panel=document.createElement('aside');panel.hidden=true;panel.dataset.testid='render-performance';
  panel.style.cssText='position:fixed;top:12px;right:12px;z-index:100;background:#111e;color:#e1edf4;padding:14px;border:1px solid #52616c;border-radius:10px;font:12px/1.5 monospace;max-height:85vh;overflow:auto';
  panel.innerHTML='<strong>City renderer · F3</strong><pre></pre><label>Lighting <select data-lighting aria-label="Scene lighting"><option value="14">Daylight</option><option value="18">Golden hour</option><option value="22">Night</option><option value="simulation">Simulation clock</option></select></label><label>Quality <select aria-label="Render quality"></select></label><label>Geometry <select data-geometry aria-label="Geometry detail"><option>LOW</option><option selected>MEDIUM</option><option>HIGH</option><option>ULTRA</option></select></label><label>Geometry view <select data-geometry-debug aria-label="Geometry debug"><option value="off">Off</option><option value="lod">Show LOD</option><option value="heatmap">Triangle heatmap</option></select></label><label><input type="checkbox" data-wireframe>Wireframe selected</label><div data-features></div><button data-cutaway>Selected cutaway</button><button data-photo>Photo mode</button><button data-record>Record 30 seconds</button><button data-export>Export JSON</button><p role="status"></p>';
  const select=panel.querySelector('[aria-label="Render quality"]');
  panel.querySelector('[data-lighting]').onchange=event=>{if(event.target.value==='simulation')delete state.timeOfDay;else api.setTimeOfDay(Number(event.target.value));};
  panel.querySelector('[data-geometry]').onchange=event=>api.setGeometryDetail(event.target.value);
  panel.querySelector('[data-geometry-debug]').onchange=event=>{geometryDebug.mode=event.target.value;};
  panel.querySelector('[data-wireframe]').onchange=event=>{geometryDebug.wireframe=event.target.checked;};
  for(const name of Object.keys(PRESETS)){const option=document.createElement('option');option.value=option.textContent=name;select.append(option);}select.value=quality.preset;
  select.onchange=()=>api.setQuality(select.value);
  for(const name of Object.keys(features)) {
    const label=document.createElement('label');label.style.cssText='display:inline-block;margin:4px';
    const input=document.createElement('input');input.type='checkbox';input.checked=features[name];input.onchange=()=>api.setFeature(name,input.checked);label.append(input,document.createTextNode(name));panel.querySelector('[data-features]').append(label);
  }
  panel.querySelector('[data-cutaway]').onclick=()=>api.setCutaway(!cutaway.enabled);
  panel.querySelector('[data-photo]').onclick=()=>api.setPhotoMode(!photoPreset);
  panel.querySelector('[data-record]').onclick=()=>api.startBenchmark();
  panel.querySelector('[data-export]').onclick=()=>{
    if(!stats.lastReport){panel.querySelector('[role=status]').textContent='Finish a recording first.';return;}
    const url=URL.createObjectURL(new Blob([JSON.stringify(stats.lastReport,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='city-benchmark.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const targetLabel=document.createElement('label');targetLabel.textContent='Frame-rate target ';const targetSelect=document.createElement('select');targetSelect.setAttribute('aria-label','Frame-rate target');for(const fps of [30,60,120,144]){const option=document.createElement('option');option.value=String(fps);option.textContent=fps+' FPS target';targetSelect.append(option);}targetSelect.value=String(quality.targetFPS);targetSelect.onchange=()=>api.setTargetFPS(Number(targetSelect.value));targetLabel.append(targetSelect);panel.append(targetLabel);const targetNote=document.createElement('small');targetNote.textContent='Quality target only. Actual FPS depends on hardware, display and city load.';panel.append(targetNote);
  const graphicsButton=document.createElement('button');graphicsButton.textContent='Graphics';graphicsButton.setAttribute('aria-label','Open graphics settings');graphicsButton.style.cssText='position:fixed;bottom:12px;left:50%;transform:translateX(-50%);z-index:80;background:#18242e;color:#e1edf4';graphicsButton.onclick=()=>{panel.hidden=!panel.hidden;};
  if(!embed)document.body.append(panel,graphicsButton);
  function hotkey(event){if(event.code==='F3'){event.preventDefault();panel.hidden=!panel.hidden;}}
  addEventListener('keydown',hotkey);
  function applyQuality(){
    const s=quality.settings,key=JSON.stringify([s,features.shadows]);if(key===lastSettings)return;lastSettings=key;
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,embed?1:s.dpr)*s.scale);renderer.setSize(innerWidth,innerHeight);
    renderer.shadowMap.enabled=features.shadows&&s.shadows;
    if(sun.shadow.mapSize.x!==s.shadowSize){sun.shadow.mapSize.setScalar(s.shadowSize);sun.shadow.map?.dispose();sun.shadow.map=null;}
  }
  const api={
    renderCity(next){api.updateCity(next);active=true;},
    updateCity(next={}){state={...state,...next};if(next.constructionProjects)construction.update(next.constructionProjects);if(next.weather)api.setWeather(next.weather);if(next.timeOfDay!=null)api.setTimeOfDay(next.timeOfDay);},
    setQuality(name){quality.setPreset(name.toUpperCase());select.value=quality.preset;applyQuality();},
    setFeature(name,value){if(!(name in features))throw new RangeError(`Unknown render feature: ${name}`);features[name]=Boolean(value);lastSettings='';},
    setTargetFPS(value){quality.setTargetFPS(value);targetSelect.value=String(value);lastSettings='';applyQuality();},
    setAdaptiveQuality(value){adaptiveEnabled=Boolean(value);},
    setGeometryDetail(value){if(!['LOW','MEDIUM','HIGH','ULTRA'].includes(value))throw new RangeError('Unknown geometry detail');if(geometryDetail)geometryDetail.quality=value;},
    getGeometryStats(){return {...geometryDebug.getGeometryStats(),grass:grass.getStats(),assets:detailAssets.getStats()};},
    loadDetailAsset(options){return detailAssets.load(options);},
    setCutaway(value){cutaway.enabled=Boolean(value);},
    setWeather(value){details.setWeather(value);state.weather=value;},
    setTimeOfDay(hour){if(!Number.isFinite(hour))throw new TypeError('Hour must be finite');state.timeOfDay=((hour%24)+24)%24;},
    get timeOfDay(){return state.timeOfDay;},
    get density(){return quality.settings.density;},
    get cutawayEnabled(){return cutaway.enabled;},
    pickVehicle(raycaster){return details.pickVehicle?.(raycaster)||null;},
    getVehicle(id){return details.getVehicle?.(id)||null;},
    getPerformanceStats(){return {...cached,backend:mode,quality:quality.preset,settings:quality.settings,features:{...features},geometryError:geometryDetail?.error,recording:!!stats.recording,lastBenchmark:stats.lastReport};},
    startBenchmark({scripted=false}={}){benchmarkStart=scripted?performance.now():null;stats.start(performance.now(),{backend:mode,preset:quality.preset,features:{...features},url:location.href,userAgent:navigator.userAgent,viewport:[innerWidth,innerHeight],devicePixelRatio,adaptive:false,settings:quality.settings,geometryDetail:geometryDetail?.quality,scripted});},
    focusBuilding(id){const b=town.buildings.find(b=>String(b.id)===String(id)||b.index===id);if(!b)return false;state.selectedBuilding=b.id;focus={target:new THREE.Vector3(b.center[0],b.height/2,b.center[1]),position:new THREE.Vector3(b.center[0]+b.height*1.8+35,b.height*1.5+30,b.center[1]+b.height*1.8+35)};return true;},
    focusDistrict({x=0,z=0,radius=250}={}){focus={target:new THREE.Vector3(x,0,z),position:new THREE.Vector3(x+radius,radius,z+radius)};},
    enterCity(){active=true;renderer.domElement.style.visibility='';},
    leaveCity(){active=false;renderer.domElement.style.visibility='hidden';},
    setPhotoMode(enabled){if(enabled&&!photoPreset){photoPreset=quality.preset;api.setQuality('ULTRA');}else if(!enabled&&photoPreset){const previous=photoPreset;photoPreset=null;api.setQuality(previous);}},
    beforeFrame(now,dt,daylight,selected,visuals={},motion={now,dt}){
      if(disposed)return;applyQuality();
      if(focus){const alpha=1-Math.exp(-dt*5);camera.position.lerp(focus.position,alpha);controls.target.lerp(focus.target,alpha);camera.lookAt(controls.target);if(camera.position.distanceTo(focus.position)<.1)focus=null;}
      if(benchmarkStart!=null){const seconds=(now-benchmarkStart)/1000;scriptedCamera(camera,controls,seconds);camera.lookAt(controls.target);if(seconds>=24)api.setTimeOfDay(22);if(seconds>=30)benchmarkStart=null;}
      construction.animate(motion.now,features.construction);
      environment.update(daylight,features.environment);
      skyDome.update(camera,daylight,state.weather,features.sky&&!visuals.skyColor);
      scene.fog=features.atmosphere?fog:null;fog.color.setHex(0x91afbf).multiplyScalar(.08+.92*daylight);
      visible=visibility.update(camera,quality.settings.distance,selected??state.selectedBuilding,features.shadows&&quality.settings.shadows,features.culling);
      const selectedId=selected??state.selectedBuilding;
      geometryDetail?.update(now,camera,selectedId,innerHeight);
      visible.instances=lod.update(camera,selectedId,features.lod);
      geometryDebug.update(camera,selectedId,innerHeight);
      cutaway.select(town.buildings.find(b=>b.index===selectedId||String(b.id)===String(selectedId)),state.occupancy);
      cutaway.update(now);
      grass.update(motion.now,camera,quality.settings,features.grass&&features.vegetation,quality.preset);
      detailAssets.update(motion.now,camera,quality.settings,features);
      details.update(motion.now,motion.dt,camera,{...quality.settings,geometryRadius:({LOW:.6,MEDIUM:1,HIGH:1.3,ULTRA:1.6})[geometryDetail?.quality||'MEDIUM']},features,state);
      for(const facade of facades){facade.setNight(1-daylight);facade.setEnabled(features.facades);facade.setInteriorEnabled(features.interiors&&quality.settings.interiors);facade.setOccupancy(Number.isFinite(state.vacancy)?1-state.vacancy:.7);}
      return active;
    },
    afterFrame(now,cpuMs,frameMs){
      if(disposed)return;frameIndex++;gpu.sample();
      const info=renderer.info;
      const sample={frameMs,cpuMs,gpuMs:gpu.ms,drawCalls:info.render.drawCalls,triangles:info.render.triangles,textures:info.memory.textures,textureBytes:null,renderInstances,...visible};
      stats.push(sample,now);
      if(document.visibilityState!=='hidden'&&adaptiveEnabled&&!photoPreset&&!stats.recording&&quality.sample(frameMs,gpu.ms,cpuMs))applyQuality();
      if(now-lastOverlay>250){lastOverlay=now;renderInstances=0;scene.traverseVisible(object=>{if(object.isInstancedMesh)renderInstances+=object.count;});cached=stats.current;
        if(!panel.hidden){const n=v=>v==null?'unavailable':v.toFixed(2);panel.querySelector('pre').textContent=`${mode.toUpperCase()} · ${quality.preset}\nFPS ${n(cached.fps)} · 1% low ${n(cached.onePercentLowFps)}\nCPU ${n(cpuMs)} ms · GPU ${n(gpu.ms)} ms\nFrame p95 ${n(cached.p95FrameMs)} ms\nDraws ${sample.drawCalls} · triangles ${sample.triangles}\nTextures ${sample.textures} · texture bytes unavailable\nInstances ${renderInstances} · HLOD ${visible.instances}\nChunks ${visible.visibleChunks} · buildings ${visible.visibleObjects}\nShadow casters ${visible.shadowCasters}\nGeometry ${(geometryDebug.stats.bytes/1048576).toFixed(1)} MiB · LOD ${geometryDebug.stats.lodCounts.join("/")}\nGrass ${grass.getStats().blades} blades · ${grass.getStats().drawCalls} draw\nScale ${quality.settings.scale.toFixed(2)} · slow frames ${cached.slowFrames}`;
          panel.querySelector('[role=status]').textContent=stats.recording?'Recording… quality held fixed':stats.lastReport?'Recording complete. Export JSON to compare.':'';
        }
      }
    },
    destroy(){disposed=true;removeEventListener('keydown',hotkey);panel.remove();graphicsButton.remove();details.dispose();lod.dispose();cutaway.dispose();construction.dispose();environment.dispose();grass.dispose();detailAssets.dispose();skyDome.dispose();geometryDebug.dispose();geometryDetail?.dispose();geometryCache?.dispose();},
  };
  applyQuality();return api;
}
