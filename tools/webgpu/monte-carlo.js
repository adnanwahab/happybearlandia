const $ = id => document.getElementById(id);
const common = `struct Params { n:u32, seed:u32, steps:u32, samples:u32, a:f32, b:f32, c:f32, d:f32 };
@group(0) @binding(0) var<uniform> p:Params;
@group(0) @binding(1) var<storage,read_write> out:array<f32>;
fn hash(x:u32)->u32 { var v=x; v=(v^(v>>16u))*2246822519u; v=(v^(v>>13u))*3266489917u; return v^(v>>16u); }
fn rand(s:ptr<function,u32>)->f32 { *s=hash(*s+2654435769u); return f32(*s>>8u)/16777216.0; }
`;
const monteShader = common + `@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id:vec3<u32>) {
let i=id.x; if(i>=p.n){return;} var seed=hash(p.seed+i*747796405u); var hits=0u;
for(var j=0u;j<p.samples;j++){let x=rand(&seed); let y=rand(&seed); if(x*x+y*y<=1.0){hits++;} if(j==0u){out[i*3u+1u]=x;out[i*3u+2u]=y;}}
out[i*3u]=f32(hits);
}`;
let device, pipeline, busy = false, previous, history = [], runNumber = 0;
const fmt = n => n.toLocaleString();
const status = text => $('status').textContent = text;
const presets = {quick:[1024,64],balanced:[4096,256],precise:[16384,1024]};
function updateBudget(){
  $('budget').textContent=fmt(+$('count').value*+$('samples').value);
  document.querySelectorAll('[data-preset]').forEach(button=>button.classList.toggle('selected',presets[button.dataset.preset].join()===[$('count').value,$('samples').value].join()));
}
function hash(x){x=Math.imul(x^(x>>>16),2246822519);x=Math.imul(x^(x>>>13),3266489917);return (x^(x>>>16))>>>0;}
async function cpuRun(n,samples,seed){
  const data=new Float32Array(n*3);
  // Match the integer hash and 24-bit random fractions used by the WGSL shader.
  for(let i=0;i<n;i++){
    let state=hash((seed+Math.imul(i,747796405))>>>0),hits=0;
    for(let j=0;j<samples;j++){
      state=hash((state+2654435769)>>>0); const x=(state>>>8)/16777216;
      state=hash((state+2654435769)>>>0); const y=(state>>>8)/16777216;
      if(x*x+y*y<=1)hits++;
      if(j===0){data[i*3+1]=x;data[i*3+2]=y;}
    }
    data[i*3]=hits;
    if(i%128===127){status(`Computing on CPU · ${Math.round((i+1)/n*100)}% · ${fmt(n*samples)} samples`);await new Promise(resolve=>setTimeout(resolve,0));}
  }
  return data;
}
async function gpuRun(n,samples,seed){
  let uniform,output,read;
  device.pushErrorScope('validation');
  try{
    const size=n*12;
    uniform=device.createBuffer({size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
    device.queue.writeBuffer(uniform,0,new Uint32Array([n,seed,0,samples,0,0,0,0]));
    output=device.createBuffer({size,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});
    read=device.createBuffer({size,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
    const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:uniform}},{binding:1,resource:{buffer:output}}]});
    const encoder=device.createCommandEncoder(), pass=encoder.beginComputePass();
    pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(n/64));pass.end();
    encoder.copyBufferToBuffer(output,0,read,0,size);device.queue.submit([encoder.finish()]);
    await read.mapAsync(GPUMapMode.READ);const data=new Float32Array(read.getMappedRange()).slice();read.unmap();return data;
  }finally{
    const error=await device.popErrorScope();uniform?.destroy();output?.destroy();read?.destroy();if(error)throw Error(error.message);
  }
}
function base(id){
  const canvas=$(id),w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=w*dpr;canvas.height=h*dpr;const c=canvas.getContext('2d');c.scale(dpr,dpr);
  c.font='10px system-ui';c.fillStyle='#74867e';c.lineWidth=1;
  return {c,w,h,x:43,y:16,pw:w-57,ph:h-52};
}
function line(c,points,color,width=1){c.strokeStyle=color;c.lineWidth=width;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();}
function scatter(result){
  const {c,w,h}=base('chart1');
  // A true square preserves the geometry of the quarter circle at every viewport size.
  const size=Math.min(w-54,h-47),x=(w-size)/2+9,y=12;
  c.fillStyle='#f4f8f2';c.fillRect(x,y,size,size);
  c.fillStyle='#dfefdf';c.beginPath();c.moveTo(x,y+size);c.arc(x,y+size,size,-Math.PI/2,0);c.closePath();c.fill();
  for(let j=0;j<=4;j++){
    const v=j/4;c.strokeStyle='#d5e2d7';c.beginPath();c.moveTo(x+v*size,y);c.lineTo(x+v*size,y+size);c.moveTo(x,y+v*size);c.lineTo(x+size,y+v*size);c.stroke();
    c.fillStyle='#74867e';c.textAlign='center';c.fillText(v.toFixed(2),x+v*size,y+size+17);c.textAlign='right';c.fillText((1-v).toFixed(2),x-7,y+v*size+3);
  }
  if(result)for(let i=0;i<result.n;i++){
    const px=result.data[i*3+1],py=result.data[i*3+2];c.fillStyle=px*px+py*py<=1?'#008b7c88':'#d9806488';c.fillRect(x+px*size-1,y+(1-py)*size-1,2,2);
  }
  c.beginPath();c.strokeStyle='#007d70';c.lineWidth=1.7;c.arc(x,y+size,size,-Math.PI/2,0);c.stroke();
  c.textAlign='center';c.fillStyle='#74867e';c.fillText('x',x+size+14,y+size+3);c.fillText('y',x-7,y-5);
  if(!result){c.fillStyle='#365c50';c.font='12px system-ui';c.fillText('Your random points will appear here',x+size/2,y+size*.6);}
}
function convergence(result){
  const a=base('chart2'),{c,x,y,pw,ph}=a;
  const points=[];let hits=0;
  if(result)for(let i=0;i<result.n;i++){
    hits+=result.data[i*3];
    if(i===0||(i+1)%Math.max(1,Math.floor(result.n/250))===0||i===result.n-1){const count=(i+1)*result.samples,p=hits/count;points.push({count,value:4*p,err:1.96*4*Math.sqrt(p*(1-p)/count)});}
  }
  const low=Math.min(3.12,...points.map(p=>p.value-p.err)),high=Math.max(3.16,...points.map(p=>p.value+p.err));
  const Y=v=>y+(high-v)/(high-low)*ph, X=v=>x+v/(result?result.n*result.samples:1)*pw;
  c.textAlign='right';
  for(let j=0;j<=4;j++){const v=low+(high-low)*j/4,py=Y(v);line(c,[[x,py],[x+pw,py]],'#e1e8df');c.fillStyle='#74867e';c.fillText(v.toFixed(3),x-6,py+3);}
  c.textAlign='center';for(let j=0;j<=4;j++){const count=(result?result.n*result.samples:1)*j/4;c.fillText(result?compact(count):`${j*25}%`,x+pw*j/4,y+ph+18);}
  if(points.length){
    c.fillStyle='#008b701c';c.beginPath();[...points.map(p=>[X(p.count),Y(p.value-p.err)]),...points.slice().reverse().map(p=>[X(p.count),Y(p.value+p.err)])].forEach(([px,py],i)=>i?c.lineTo(px,py):c.moveTo(px,py));c.closePath();c.fill();
    line(c,points.map(p=>[X(p.count),Y(p.value)]),'#008b7c',1.8);
  }
  c.setLineDash([5,4]);line(c,[[x,Y(Math.PI)],[x+pw,Y(Math.PI)]],'#bb8a20',1.4);c.setLineDash([]);
  c.textAlign='left';c.fillStyle='#916915';c.fillText('π = 3.141593',x+7,Y(Math.PI)-7);
  c.textAlign='center';c.fillStyle='#74867e';c.fillText('Samples accumulated',x+pw/2,a.h-2);
}
function compact(n){return n>=1e6?(n/1e6).toFixed(1)+'m':n>=1000?(n/1000).toFixed(n>=10000?0:1)+'k':String(Math.round(n));}
function draw(){scatter(previous);convergence(previous);}
function record(result){
  const total=result.n*result.samples,hits=result.data.reduce((sum,v,i)=>i%3===0?sum+v:sum,0),p=hits/total;
  Object.assign(result,{total,hits,estimate:4*p,error:Math.abs(4*p-Math.PI),interval:1.96*4*Math.sqrt(p*(1-p)/total),id:++runNumber});
  previous=result;history.unshift(result);history=history.slice(0,12);
  $('m0').textContent=result.estimate.toFixed(6);$('m1').textContent=result.error.toFixed(6);$('interval').textContent='± '+result.interval.toFixed(6);
  $('coverage').textContent=Math.abs(result.estimate-Math.PI)<=result.interval?'True π falls inside this interval':'True π falls outside this interval';
  $('m2').textContent=fmt(total);$('m3').textContent=result.elapsed.toFixed(1)+' ms';$('hit-rate').textContent=(100*p).toFixed(2)+'% inside';
  $('run-label').textContent=`Run ${result.id.toString().padStart(2,'0')} · seed ${result.seed}`;
  $('chart1').setAttribute('aria-label',`${fmt(result.n)} representative random points. ${(p*100).toFixed(2)} percent of all samples landed inside the quarter circle.`);
  $('chart2').setAttribute('aria-label',`Cumulative estimate converges to ${result.estimate.toFixed(6)}. Final approximate 95 percent interval ${(result.estimate-result.interval).toFixed(6)} to ${(result.estimate+result.interval).toFixed(6)}.`);
  draw();renderHistory();$('download').disabled=false;
  status(`Complete · ${result.engine} · 95% interval ${(result.estimate-result.interval).toFixed(6)}–${(result.estimate+result.interval).toFixed(6)}. Change the seed to explore another outcome.`);
}
function renderHistory(){
  $('history').replaceChildren();
  history.forEach(r=>{const row=document.createElement('tr');[`${r.id.toString().padStart(2,'0')} / ${r.seed}`,fmt(r.total),r.estimate.toFixed(6),r.error.toFixed(6),'± '+r.interval.toFixed(6),`${r.engine} / ${r.elapsed.toFixed(1)} ms`].forEach(value=>{const cell=document.createElement('td');cell.textContent=value;row.append(cell);});$('history').append(row);});
  $('history-table').hidden=!history.length;$('empty-history').hidden=!!history.length;$('clear').disabled=!history.length;
}
function lock(value){busy=value;document.querySelectorAll('#controls input,#controls select,#controls button,[data-preset],#shuffle').forEach(el=>el.disabled=value);$('run').innerHTML=value?'Running experiment…':'Run experiment <span>→</span>';}
async function run(){
  if(busy||!$('controls').reportValidity())return;
  const n=+$('count').value,samples=+$('samples').value,seed=+$('seed').value;
  lock(true);status(`Computing ${fmt(n*samples)} samples on ${device?'GPU':'CPU'}…`);
  await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
  const start=performance.now();let engine=device?'WebGPU':'CPU',data;
  try{
    if(device){try{data=await gpuRun(n,samples,seed);}catch(error){console.warn('GPU computation failed; using CPU.',error);device?.destroy();device=null;engine='CPU';$('engine').textContent='CPU fallback · WebGPU run unavailable';}}
    if(!data)data=await cpuRun(n,samples,seed);
    if(!data.every(Number.isFinite))throw Error('The compute engine returned invalid samples.');
    record({data,n,samples,seed,elapsed:performance.now()-start,engine});
  }catch(error){status('Experiment failed: '+error.message+'. Please try a smaller sample count.');}finally{lock(false);}
}
document.querySelectorAll('[data-preset]').forEach(button=>button.addEventListener('click',()=>{[$('count').value,$('samples').value]=presets[button.dataset.preset];updateBudget();}));
$('controls').addEventListener('submit',e=>{e.preventDefault();run();});
['count','samples'].forEach(id=>$(id).addEventListener('change',updateBudget));
$('shuffle').addEventListener('click',()=>{$('seed').value=(crypto.getRandomValues(new Uint32Array(1))[0]||1);status('New seed selected. Run the experiment to compare the outcome.');});
$('reset').addEventListener('click',()=>{HTMLFormElement.prototype.reset.call($('controls'));updateBudget();status('Default settings restored. Run an experiment to add a new notebook entry.');});
$('clear').addEventListener('click',()=>{history=[];renderHistory();status('Notebook cleared. Your latest result remains above.');});
$('download').addEventListener('click',()=>{
  if(!previous)return;
  const rows=[['run','seed','lanes','samples_per_lane','total_samples','hits','estimate','absolute_error','interval_low_95','interval_high_95','engine','elapsed_ms'],...[...(history.length?history:[previous])].reverse().map(r=>[r.id,r.seed,r.n,r.samples,r.total,r.hits,r.estimate,r.error,r.estimate-r.interval,r.estimate+r.interval,r.engine,r.elapsed])];
  const url=URL.createObjectURL(new Blob([rows.map(row=>row.join(',')).join('\n')],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='monte-carlo-experiments.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
let resizeTimer;addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(draw,120);});
addEventListener('pagehide',()=>device?.destroy());
async function init(){
  draw();
  try{
    if(!navigator.gpu)throw Error('WebGPU unavailable');
    const adapter=await navigator.gpu.requestAdapter();if(!adapter)throw Error('No GPU adapter');
    device=await adapter.requestDevice();
    const module=device.createShaderModule({code:monteShader}),info=await module.getCompilationInfo();
    if(info.messages.some(m=>m.type==='error'))throw Error('Shader compilation failed');
    pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}});
    device.lost.then(()=>{device=null;$('engine').textContent='CPU fallback · GPU disconnected';});
    $('engine').textContent='WebGPU · parallel compute';
  }catch{device?.destroy();device=null;$('engine').textContent='CPU fallback · WebGPU unavailable';}
  $('run').disabled=false;
  // Start with a useful, reproducible result instead of empty charts.
  await run();
}
init();
