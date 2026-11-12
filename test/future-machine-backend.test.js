import {test, expect} from 'bun:test';
import {createRendererBackend} from '../world/future-machine/scene/renderer-backend.js';

function fixture({native=true, init=async()=>{}, dispose=()=>{}, partial=false}={}) {
  const instances=[], gl=[];
  class WebGPURenderer {
    constructor(options) { this.options=options;this.backend={isWebGPUBackend:native,dispose:()=>{this.backendDisposals++}};this.backendDisposals=0;this.disposals=0;if(partial)this._initialized=false;instances.push(this); }
    async init(){await init(this); if(partial)this._initialized=true;}
    dispose(){this.disposals++;return dispose();}
  }
  class WebGLRenderer {constructor(options){this.options=options;gl.push(this);}}
  return {instances,gl,THREE:{WebGLRenderer},loadWebGPU:async()=>({WebGPURenderer})};
}
async function withGPU(value, run) {
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:value?{gpu:{}}:{}});
  try {await run();} finally {if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator;}
}
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};};
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));

test('actual initialized native flag required; renderer type alone is insufficient',async()=>withGPU(true,async()=>{
  const native=fixture();const result=await createRendererBackend(native);
  expect(result).toEqual({renderer:native.instances[0],backend:'webgpu',reason:null});
  expect(native.instances[0].options).toEqual({antialias:true,alpha:false});expect(native.instances[0].disposals).toBe(0);
  const internalGL=fixture({native:false});const fallback=await createRendererBackend(internalGL);
  expect(fallback.backend).toBe('webgl');expect(fallback.renderer).toBe(internalGL.gl[0]);
  expect(fallback.reason).toContain('non-WebGPU');expect(internalGL.instances[0].disposals).toBe(1);
}));
test('force GL, disabled preference and missing API never load GPU module',async()=>{
  for(const [gpu,options,reason] of [[true,{forceWebGL:true},'explicitly'],[true,{preferWebGPU:false},'preference'],[false,{},'unavailable']]){
    await withGPU(gpu,async()=>{const f=fixture();let loads=0;const result=await createRendererBackend({...f,...options,loadWebGPU:()=>{loads++;throw Error('must not load')}});
      expect(result.backend).toBe('webgl');expect(result.reason).toContain(reason);expect(loads).toBe(0);expect(f.gl).toHaveLength(1);});
  }
});
test('load and construction failures select truthful fallback',async()=>withGPU(true,async()=>{
  for(const loadWebGPU of [async()=>{throw Error('module unavailable')},async()=>({}),async()=>({WebGPURenderer:class{constructor(){throw Error('constructor failed')}}})]){
    const f=fixture();const result=await createRendererBackend({...f,loadWebGPU});expect(result.backend).toBe('webgl');expect(result.reason).toBeString();expect(f.instances).toHaveLength(0);
  }
}));
test('failed init cleans backend without resurrecting partial renderer',async()=>withGPU(true,async()=>{
  for(const dispose of [()=>{throw Error('cleanup failed')},()=>Promise.reject(Error('cleanup failed'))]){
    const f=fixture({partial:true,init:async()=>{throw Error('adapter failed')},dispose});
    const result=await createRendererBackend(f);expect(result.reason).toBe('adapter failed');expect(result.backend).toBe('webgl');
    expect(f.instances[0].disposals).toBe(0);expect(f.instances[0].backendDisposals).toBe(1);
  }
  await flush();
}));
test('initialized failed candidates cannot block fallback with throwing async disposal',async()=>withGPU(true,async()=>{
  for(const dispose of [()=>{throw Error('dispose failed')},()=>Promise.reject(Error('dispose failed'))]){
    const f=fixture({native:false,dispose});
    const result=await createRendererBackend(f);
    expect(result.backend).toBe('webgl');expect(f.instances[0].disposals).toBe(1);
  }
  await flush();
}));
test('deadline bounds stalled init; late initialized resources are released again',async()=>withGPU(true,async()=>{
  const gate=deferred(),f=fixture({partial:true,init:()=>gate.promise});
  const result=await createRendererBackend({...f,timeoutMs:5});
  expect(result.backend).toBe('webgl');expect(result.reason).toContain('exceeded 5ms');expect(f.instances[0].disposals).toBe(0);expect(f.instances[0].backendDisposals).toBe(1);
  gate.resolve();await flush();expect(f.instances[0].disposals).toBe(1);expect(f.gl).toHaveLength(1);
}));
test('late init rejection is consumed and cleaned; late module never constructs renderer',async()=>withGPU(true,async()=>{
  const gate=deferred(),f=fixture({init:()=>gate.promise});
  await createRendererBackend({...f,timeoutMs:5});gate.reject(Error('late failure'));await flush();expect(f.instances[0].disposals).toBe(2);
  const module=deferred(),g=fixture();const result=await createRendererBackend({...g,loadWebGPU:()=>module.promise,timeoutMs:5});
  expect(result.backend).toBe('webgl');module.resolve(await g.loadWebGPU());await flush();expect(g.instances).toHaveLength(0);
}));
test('fallback failure propagates so host can retain Canvas/inventory fallback',async()=>withGPU(false,async()=>{
  await expect(createRendererBackend({THREE:{WebGLRenderer:class{constructor(){throw Error('WebGL unavailable')}}}})).rejects.toThrow('WebGL unavailable');
}));
test('invalid dependencies and unbounded deadlines fail explicitly',async()=>{
  await expect(createRendererBackend()).rejects.toThrow('THREE');
  for(const timeoutMs of [0,-1,NaN,Infinity,60001]) await expect(createRendererBackend({...fixture(),timeoutMs})).rejects.toThrow('timeout');
});

// Opt-in real renderer proof; ordinary unit runs do not require a browser.
// HBL_BACKEND_BROWSER=1 bun test test/future-machine-backend.test.js
// On this macOS host bundled Chromium 153's SwiftShader swapchain is invalid;
// HBL_BACKEND_ANGLE=metal selects the actual Metal adapter for native proof.
// No browser errors are filtered, and the default software path can still fail.
const browserTest=process.env.HBL_BACKEND_BROWSER==='1'?test:test.skip;
browserTest('real Chromium renderer, scissor/resize and before/after-init failure smoke',async()=>{
  const {chromium}=await import('playwright');
  const {dirname,join}=await import('node:path');
  const {fileURLToPath}=await import('node:url');
  const {mkdtempSync,writeFileSync}=await import('node:fs');
  const {tmpdir}=await import('node:os');
  const build=dirname(fileURLToPath(import.meta.resolve('three')));
  const modulePath=fileURLToPath(new URL('../world/future-machine/scene/renderer-backend.js',import.meta.url));
  const artifactDir=mkdtempSync(join(tmpdir(),'hbl-renderer-backend-'));
  const server=Bun.serve({port:0,hostname:'127.0.0.1',fetch(request){
    const path=new URL(request.url).pathname;
    if(path==='/')return new Response('<!doctype html><script type="importmap">{"imports":{"three":"/vendor/three.module.js","three/webgpu":"/vendor/three.webgpu.js"}}</script>',{headers:{'Content-Type':'text/html'}});
    if(path==='/favicon.ico')return new Response(null,{status:204});
    if(path==='/backend.js')return new Response(Bun.file(modulePath));
    if(/^\/vendor\/three[.a-z]*\.js$/.test(path))return new Response(Bun.file(join(build,path.slice(8))));
    return new Response('',{status:404});
  }});
  let browser;
  try {
    browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--enable-unsafe-webgpu','--enable-unsafe-swiftshader',...(process.env.HBL_BACKEND_ANGLE?[`--use-angle=${process.env.HBL_BACKEND_ANGLE}`]:[])]});
    const diagnostics=[],errors=[];
    // A renderer is fully drained and disposed before the next case starts.
    // Separate pages also isolate each GPU device/canvas lifecycle.
    for(const mode of ['preferred','forced','failure-before-init','failure-after-init']){
      const page=await browser.newPage({viewport:{width:820,height:420}});
      page.on('pageerror',error=>errors.push({mode,message:error.message}));
      page.on('console',message=>{if(message.type()==='error')errors.push({mode,message:message.text()});});
      await page.goto(`http://127.0.0.1:${server.port}/`);
      const result=await page.evaluate(async mode=>{
        const THREE=await import('three'),{createRendererBackend}=await import('/backend.js');
        let failedRenderer=null,disposals=0;
        const options={THREE};
        if(mode==='forced')options.forceWebGL=true;
        if(mode.startsWith('failure'))options.loadWebGPU=async()=>{
          const module=await import('three/webgpu');
          return {WebGPURenderer:class extends module.WebGPURenderer{
            constructor(options){super(options);failedRenderer=this;}
            async init(){if(mode==='failure-after-init')await super.init();throw Error(mode);}
            async dispose(){disposals++;await super.dispose();}
          }};
        };
        const {renderer,backend,reason}=await createRendererBackend(options);
        document.body.append(renderer.domElement);
        const scene=new THREE.Scene();
        scene.add(new THREE.HemisphereLight(0xffffff,0x222222,3));
        const material=new THREE.MeshStandardMaterial({color:0x40d9c4}),geometry=new THREE.BoxGeometry(2,3,2);
        scene.add(new THREE.Mesh(geometry,material));
        const camera=new THREE.PerspectiveCamera(45,1,.1,100);camera.position.set(5,5,5);camera.lookAt(0,0,0);
        renderer.setSize(800,400);renderer.setClearColor(0x10232d,1);renderer.autoClear=false;
        if(renderer.compileAsync)await renderer.compileAsync(scene,camera);
        globalThis.rendererSmoke={renderer,geometry,material,scene,camera};
        return {mode,backend,reason,nativeFlag:renderer.backend?.isWebGPUBackend===true,disposals,failedConstructed:!!failedRenderer,gpuAPI:!!navigator.gpu,adapterInfo:renderer.backend?.device?.adapterInfo?Object.fromEntries(['vendor','architecture','device','description'].map(key=>[key,renderer.backend.device.adapterInfo[key]])):null};
      },mode);
      console.log('Isolated renderer initialized',browser.version(),JSON.stringify(result));
      result.sizes=[];result.pixels=[];
      for(const width of [800,390]){
        const frame=await page.evaluate(async width=>{
          const {renderer,scene,camera}=globalThis.rendererSmoke;
          // Present the previous frame before reconfiguring its canvas, then
          // draw each viewport in the next animation frame with one full clear.
          await renderer.backend?.device?.queue.onSubmittedWorkDone();
          renderer.setSize(width,400);camera.aspect=width/2/400;camera.updateProjectionMatrix();
          const draw=()=>{
            renderer.setScissorTest(false);renderer.clear();renderer.setScissorTest(true);
            for(let side=0;side<2;side++){renderer.setViewport(side*width/2,0,width/2,400);renderer.setScissor(side*width/2,0,width/2,400);renderer.render(scene,camera);}
            globalThis.rendererSmoke.raf=requestAnimationFrame(draw);
          };
          await new Promise(resolve=>requestAnimationFrame(()=>{draw();resolve();}));
          await renderer.backend?.device?.queue.onSubmittedWorkDone();
          return [renderer.domElement.width,renderer.domElement.height];
        },width);
        result.sizes.push(frame);
        const screenshot=await page.screenshot({path:join(artifactDir,`${mode}-${width}px.png`)});
        // Decode the captured presentation, not the discarded canvas backbuffer.
        const pixels=await page.evaluate(async png=>{
          const image=new Image();image.src=`data:image/png;base64,${png}`;await image.decode();
          const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
          const context=canvas.getContext('2d');context.drawImage(image,0,0);
          const box=globalThis.rendererSmoke.renderer.domElement.getBoundingClientRect();
          return [context.getImageData(box.x+box.width/4,box.y+200,1,1).data.slice(0,3),context.getImageData(box.x+box.width*3/4,box.y+200,1,1).data.slice(0,3)].map(value=>Array.from(value));
        },screenshot.toString('base64'));
        result.pixels.push(pixels);
        await page.evaluate(async()=>{cancelAnimationFrame(globalThis.rendererSmoke.raf);await globalThis.rendererSmoke.renderer.backend?.device?.queue.onSubmittedWorkDone();});
      }
      await page.evaluate(async()=>{const {renderer,geometry,material}=globalThis.rendererSmoke;geometry.dispose();material.dispose();await renderer.dispose();renderer.domElement.remove();});
      await page.close();diagnostics.push(result);
    }
    writeFileSync(join(artifactDir,'diagnostics.json'),JSON.stringify({browser:browser.version(),executable:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH??chromium.executablePath(),angle:process.env.HBL_BACKEND_ANGLE??null,diagnostics,errors},null,2));
    console.log('Real renderer browser evidence:',artifactDir,JSON.stringify(diagnostics),JSON.stringify(errors));
    for(const result of diagnostics){
      expect(result.backend==='webgpu').toBe(result.nativeFlag);
      expect(result.sizes).toEqual([[800,400],[390,400]]);
      if(result.mode!=='preferred')expect(result.backend).toBe('webgl');
      if(result.failedConstructed){expect(result.disposals).toBe(result.mode==='failure-before-init'?0:1);expect(result.reason).toBe(result.mode);}
      for(const pair of result.pixels)for(const [red,green,blue] of pair){expect(green).toBeGreaterThan(red+20);expect(blue).toBeGreaterThan(red+20);}
    }
    expect(errors).toEqual([]);
  }finally{await browser?.close();await server.stop(true);}
},30000);
