import {LAYOUT_VERSION} from './mapping.js';
/** Low-fidelity orthographic view of the existing City projection, never model authority. */
const MODES = ['split', 'baseline', 'plan', 'difference'];
const identity = row => `${row.collection}:${row.id}`;
const dimension = (value, fallback) => Number.isFinite(value) && value > 0 ? Math.min(value, 16384) : fallback;
const validProjection = value => value && Array.isArray(value.a) && Array.isArray(value.b) ? value : null;
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
export function canvasViewports(width, height, mode) {
  if (!MODES.includes(mode)) throw new TypeError('Unknown scene mode');
  width=dimension(width,640);height=dimension(height,400);
  return mode === 'split' ? [{x:0,y:0,width:width/2,height,arm:'baseline'}, {x:width/2,y:0,width:width/2,height,arm:'plan'}] : [{x:0,y:0,width,height,arm:mode === 'baseline' ? 'baseline' : 'plan'}];
}
export function canvasPoint(x, z, camera, viewport) {
  return {x:viewport.x+viewport.width/2+(x-camera.x)*camera.zoom,y:viewport.height/2+(z-camera.z)*camera.zoom};
}
export function canvasRows(projection, diff, arm, mode='split', ghosts=true) {
  projection=validProjection(projection);
  if (!projection) return [];
  const own = arm === 'baseline' ? projection.a : projection.b;
  const other = arm === 'baseline' ? projection.b : projection.a;
  const changes = new Map((diff?.available === false ? [] : diff?.entities || []).map(row => [identity(row), row.kind]));
  const present = new Set(own.map(identity));
  const rows = own.map(row => ({...row,arm,ghost:false,change:changes.get(identity(row)) || null}));
  if (ghosts || mode === 'difference') for (const row of other) if (!present.has(identity(row))) rows.push({...row,arm,ghost:true,change:changes.get(identity(row)) || null});
  if(ghosts)for(const row of projection.constructionGhosts?.[arm]||[])rows.push({...row,arm,ghost:true,change:'construction-preview'});
  return mode === 'difference' ? rows.filter(row => row.change) : rows;
}
function polygon(row) { return row.polygon || [[row.x-7,row.z-7],[row.x+7,row.z-7],[row.x+7,row.z+7],[row.x-7,row.z+7]]; }
function contains(points, x, z) {
  let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++) {
    const [xi,zi]=points[i], [xj,zj]=points[j];
    if (((zi>z)!==(zj>z)) && x<(xj-xi)*(z-zi)/(zj-zi)+xi) inside=!inside;
  }
  return inside;
}
export function hitTestCanvas(rows, x, y, camera, viewport) {
  if (![x,y,camera?.x,camera?.z,camera?.zoom,viewport?.x,viewport?.width,viewport?.height].every(Number.isFinite) || camera.zoom<=0 || viewport.width<=0 || viewport.height<=0) return null;
  if (x<viewport.x || x>=viewport.x+viewport.width || y<0 || y>=viewport.height) return null;
  const wx=camera.x+(x-viewport.x-viewport.width/2)/camera.zoom, wz=camera.z+(y-viewport.height/2)/camera.zoom;
  return [...rows].reverse().find(row => !row.ghost && contains(polygon(row),wx,wz)) || null;
}
export function fitCanvasCamera(projection, width, height, mode='split') {
  width=dimension(width,640);height=dimension(height,400);projection=validProjection(projection);
  const points=[...(projection?.a || []),...(projection?.b || [])].flatMap(polygon);
  if (!points.length) return {x:0,z:0,zoom:1};
  const xs=points.map(p=>p[0]), zs=points.map(p=>p[1]);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
  return {x:(minX+maxX)/2,z:(minZ+maxZ)/2,zoom:clamp(Math.min((width/(mode==='split'?2:1)-48)/Math.max(40,maxX-minX),(height-100)/Math.max(40,maxZ-minZ)),.02,16)};
}
export function createCanvasStage(container,{onSelect,onCameraChange,onCameraInteraction}={}) {
  const doc=container.ownerDocument, canvas=doc.createElement('canvas');
  canvas.tabIndex=0;canvas.setAttribute('aria-keyshortcuts','PageUp PageDown d');
  canvas.setAttribute('aria-label','Low fidelity City map. Drag or arrow keys to pan; scroll, pinch, plus or minus to zoom. Click a building or project to inspect.');
  canvas.style.cssText='display:block;width:100%;height:100%;min-height:280px;touch-action:none;outline-offset:-3px';
  container.append(canvas);
  let ctx;
  try {ctx=canvas.getContext('2d');} catch(error) {canvas.remove();throw error;}
  if (!ctx) {canvas.remove();throw new Error('Canvas2D unavailable');}
  let familyBuildings={};
  let projection=null,diff=null,mode='split',ghosts=true,selected=null,disposed=false,fitted=false;
  let pixelRatio=null;
  let width=1,height=1,camera={x:0,z:0,zoom:1},drawn=0;
  const pointers=new Map(), listeners=[];
  let gesture=null;
  const listen=(target,name,fn,options)=>{target.addEventListener(name,fn,options);listeners.push(()=>target.removeEventListener(name,fn,options));};
  function draw() {
    if(disposed)return;
    ctx.clearRect(0,0,width,height);drawn=0;
    const viewports=canvasViewports(width,height,mode);
    for(const view of viewports) {
      ctx.save();ctx.beginPath();ctx.rect(view.x,0,view.width,height);ctx.clip();
      ctx.fillStyle=view.arm==='baseline'?'#102936':'#102f31';ctx.fillRect(view.x,0,view.width,height);
      ctx.strokeStyle='#26434b';ctx.lineWidth=1;
      const spacing=24*camera.zoom;
      if(spacing>=8) {
        const origin=canvasPoint(0,0,camera,view);
        ctx.beginPath();
        for(let x=view.x+((origin.x-view.x)%spacing+spacing)%spacing;x<view.x+view.width;x+=spacing){ctx.moveTo(x,0);ctx.lineTo(x,height);}
        for(let y=((origin.y%spacing)+spacing)%spacing;y<height;y+=spacing){ctx.moveTo(view.x,y);ctx.lineTo(view.x+view.width,y);}
        ctx.stroke();
      }
      for(const row of canvasRows(projection,diff,view.arm,mode,ghosts)) {
        const points=polygon(row).map(([x,z])=>canvasPoint(x,z,camera,view));
        ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
        const active=selected?.collection===row.collection&&selected?.id===row.id || row.collection==='buildings'&&familyBuildings[view.arm]===row.id;
        ctx.setLineDash(row.ghost?[5,4]:[]);
        ctx.fillStyle=row.ghost?'#9fe4f015':row.collection==='projects'?'#d6a25c':row.change?'#56dca4':'#7d9fae';
        ctx.strokeStyle=active?'#fff2a1':row.ghost?'#9fe4f0':row.change?'#a0ffd0':'#bfd4df';
        ctx.lineWidth=active?4:row.change?2:1;ctx.fill();ctx.stroke();ctx.setLineDash([]);drawn++;
        const center=canvasPoint(row.x,row.z,camera,view);
        if(row.progress!==undefined&&!row.ghost) {ctx.fillStyle='#17242b';ctx.fillRect(center.x-7*camera.zoom,center.y-2,14*camera.zoom,4);ctx.fillStyle='#fff0bc';ctx.fillRect(center.x-7*camera.zoom,center.y-2,14*camera.zoom*row.progress,4);}
        if(camera.zoom>=2&&!row.ghost&&center.x>=view.x&&center.x<=view.x+view.width&&center.y>=54&&center.y<height-44) {
          ctx.font='10px system-ui';ctx.fillStyle='#f3f8fa';
          const text=ctx.measureText(row.id),maxWidth=Math.max(1,Math.min(Math.max(30,22*camera.zoom),view.width-12));
          const textWidth=Math.min(text?.width??row.id.length*6,maxWidth);
          const ascent=text?.actualBoundingBoxAscent??10,descent=text?.actualBoundingBoxDescent??3;
          // Fit ink inside this arm and above the footer without moving the camera.
          const x=clamp(center.x-6,view.x+6,view.x+view.width-6-textWidth);
          const y=clamp(center.y+19*camera.zoom,54+ascent,height-44-6-descent);
          ctx.fillText(row.id,x,y,maxWidth);
        }
      }
      ctx.fillStyle='#eaf7fa';ctx.font='bold 14px system-ui';ctx.fillText(mode==='difference'?'RECORDED DIFFERENCES':view.arm==='baseline'?'WITHOUT PLAN':'WITH PLAN',view.x+14,25);
      ctx.font='11px system-ui';ctx.fillText(`Month ${projection?.month ?? '—'} · ${canvasRows(projection,diff,view.arm,mode,false).filter(r=>!r.ghost).length} locations`,view.x+14,44);
      ctx.restore();
    }
    if(mode==='split'){ctx.fillStyle='#a4c6d8';ctx.fillRect(width/2-1,0,2,height);}
    ctx.fillStyle='#10232de8';ctx.fillRect(0,height-44,width,44);ctx.fillStyle='#eaf7fa';ctx.font='11px system-ui';
    ctx.fillText(width<500?'Low fidelity · unlocated data uses synthetic layout':'Low fidelity · Synthetic layout for unlocated City inventory · sourced footprints where available',12,height-27,Math.max(1,width-24));
    const previews=ghosts&&Object.values(projection?.constructionGhosts??{}).some(rows=>rows.length);
    const legend=previews?'Dashed: next-month preview / other-future ghost':'Green: recorded change · dashed: other-future ghost';
    ctx.fillText(width<500?legend:`${legend} · drag / arrows: pan · scroll / pinch / ±: zoom`,12,height-10,Math.max(1,width-24));
  }
  function changed(){draw();onCameraChange?.({...camera});}
  function resize(){if(disposed)return;width=dimension(container.clientWidth,640);height=Math.max(280,dimension(container.clientHeight,400));const ratio=pixelRatio??Math.min(dimension(globalThis.devicePixelRatio,1),2);canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);if(!fitted&&projection&&(projection.a.length||projection.b.length)){camera=fitCanvasCamera(projection,width,height,mode);fitted=true;}draw();}
  function local(e){const box=canvas.getBoundingClientRect();if(!Number.isFinite(box.width)||!Number.isFinite(box.height)||box.width<=0||box.height<=0||!Number.isFinite(e.clientX)||!Number.isFinite(e.clientY))return null;return {x:(e.clientX-box.left)*width/box.width,y:(e.clientY-box.top)*height/box.height};}
  function distance(){const p=[...pointers.values()];return p.length>1?Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y):0;}
  function startGesture(){const p=[...pointers.values()];gesture={start:{...p[0]},camera:{...camera},distance:distance(),moved:false};}
  let observer=null;
  try {
  listen(canvas,'pointerdown',e=>{if(e.button!==undefined&&e.button!==0)return;const point=local(e);if(!point)return;onCameraInteraction?.();canvas.focus();pointers.set(e.pointerId,point);canvas.setPointerCapture?.(e.pointerId);startGesture();});
  listen(canvas,'pointermove',e=>{if(!pointers.has(e.pointerId)||!gesture)return;const point=local(e);if(!point)return;pointers.set(e.pointerId,point);const p=[...pointers.values()][0];const dx=p.x-gesture.start.x,dy=p.y-gesture.start.y;if(Math.hypot(dx,dy)>3||pointers.size>1)gesture.moved=true;camera={x:gesture.camera.x-dx/gesture.camera.zoom,z:gesture.camera.z-dy/gesture.camera.zoom,zoom:clamp(gesture.camera.zoom*(gesture.distance?distance()/gesture.distance:1),.02,32)};changed();});
  function end(e){if(!pointers.has(e.pointerId))return;const point=local(e), click=point&&gesture&&!gesture.moved&&pointers.size===1&&Math.hypot(point.x-gesture.start.x,point.y-gesture.start.y)<=3;pointers.delete(e.pointerId);if(click&&e.type==='pointerup'){for(const view of canvasViewports(width,height,mode)){const hit=hitTestCanvas(canvasRows(projection,diff,view.arm,mode,ghosts),point.x,point.y,camera,view);if(hit){selected=hit;draw();onSelect?.({collection:hit.collection,id:hit.id,arm:view.arm});break;}}}if(pointers.size){startGesture();gesture.moved=true;}else gesture=null;}
  listen(canvas,'pointerup',end);listen(canvas,'pointercancel',end);listen(canvas,'lostpointercapture',end);
  listen(canvas,'wheel',e=>{if(!Number.isFinite(e.deltaY))return;onCameraInteraction?.();e.preventDefault();camera.zoom=clamp(camera.zoom*Math.exp(-clamp(e.deltaY,-200,200)*.003),.02,32);changed();},{passive:false});
  listen(canvas,'keydown',e=>{const delta=30/camera.zoom;switch(e.key){case 'ArrowLeft':camera.x-=delta;break;case 'ArrowRight':camera.x+=delta;break;case 'ArrowUp':camera.z-=delta;break;case 'ArrowDown':camera.z+=delta;break;case '+':case '=':camera.zoom=clamp(camera.zoom*1.2,.02,32);break;case '-':camera.zoom=clamp(camera.zoom/1.2,.02,32);break;case 'Home':camera=fitCanvasCamera(projection,width,height,mode);break;default:return;}onCameraInteraction?.();e.preventDefault();changed();});
  observer=globalThis.ResizeObserver?new ResizeObserver(resize):null;observer?.observe(container);
  if(globalThis.addEventListener)listen(globalThis,'resize',resize);
  resize();
  } catch(error) {observer?.disconnect();for(const remove of listeners)remove();canvas.width=0;canvas.height=0;canvas.remove();throw error;}
  return {
    update(next,nextDiff){if(disposed)return;projection=validProjection(next);diff=nextDiff;pointers.clear();gesture=null;if(!fitted&&projection&&(projection.a.length||projection.b.length)){camera=fitCanvasCamera(projection,width,height,mode);fitted=true;}draw();},
    setMode(next){if(!MODES.includes(next))throw new TypeError('Unknown scene mode');if(disposed)return;mode=next;draw();},
    setGhosts(value){if(disposed)return;ghosts=Boolean(value);draw();},
    setFamilyBuildings(value){familyBuildings=value;draw();},
    focus(entity,{scale}={}){if(disposed)return false;const row=[...(projection?.a||[]),...(projection?.b||[])].find(r=>identity(r)===identity(entity||{}));if(!row)return false;selected={collection:row.collection,id:row.id};camera={...camera,x:row.x,z:row.z,...(scale?{zoom:Math.min(width/(mode==='split'?2:1),height)/(scale==='neighborhood'?400:150)}:{})};changed();return true;},
    setPixelRatio(value){if(!Number.isFinite(value)||value<=0||value>2)throw new RangeError('Pixel ratio must be positive and at most 2');pixelRatio=value;resize();},
    getCamera(){return {...camera};},
    setCamera(next){if(!next||!Number.isFinite(next.x)||!Number.isFinite(next.z)||!Number.isFinite(next.zoom)||next.zoom<=0)throw new TypeError('Camera requires finite x, z and positive zoom');if(disposed)return;camera={x:next.x,z:next.z,zoom:clamp(next.zoom,.02,32)};fitted=true;draw();},
    getStats(){return {backend:'canvas2d',objects:disposed?0:drawn,canvases:disposed?0:1,month:projection?.month??null,mode,ghosts,disposed,animationFrames:0,layoutVersion:LAYOUT_VERSION};},
    dispose(){if(disposed)return;disposed=true;observer?.disconnect();for(const remove of listeners)remove();listeners.length=0;pointers.clear();projection=null;diff=null;canvas.width=0;canvas.height=0;canvas.remove();},
  };
}
