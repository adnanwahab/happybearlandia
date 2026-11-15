import {clipFrames,encodeGIF,palettePixels} from '../share/clip.js';
import {createCanvasStage} from '../scene/canvas-stage.js';
import {createSpatialMapping} from '../scene/mapping.js';

export function mountClip(root,{getContext}) {
  const panel=document.createElement('section');panel.className='fm-clip';
  panel.innerHTML='<h2>Replay clip</h2><p>Ten seconds, ten held monthly snapshots ending at the selected month. Early months repeat the last available frame. Synthetic modeled results · manifest recomputation, not independently verified checkpoints. Schematic cosmetic layout; no interpolated states or audio. Nothing is uploaded.</p><button type="button" disabled>Prepare replay clip</button><p role="status"></p><div class="clip-preview"></div><button type="button" hidden>Play GIF preview once</button><a hidden>Download muted ten-second GIF</a> <a hidden>Download static PNG fallback</a>';
  root.append(panel);
  const [prepare,play]=panel.querySelectorAll('button'),[download,still]=panel.querySelectorAll('a'),status=panel.querySelector('[role=status]'),preview=panel.querySelector('.clip-preview');
  let busy=false,disposed=false,urls=[];
  const clear=()=>{for(const url of urls)URL.revokeObjectURL(url);urls=[];preview.replaceChildren();play.hidden=download.hidden=still.hidden=true;};
  const url=blob=>{const value=URL.createObjectURL(blob);urls.push(value);return value;};
  prepare.onclick=async()=>{
    if(busy)return;busy=true;prepare.disabled=true;clear();status.textContent='Preparing ten exact frames…';
    let stage,host;
    try{
      const {history,month}=getContext(),frames=clipFrames(history,month);
      const seed=history.seed,model=history.modelVersion,run=history.experimentId;
      host=document.createElement('div');host.style.cssText='position:fixed;left:-10000px;width:640px;height:280px';document.body.append(host);
      stage=createCanvasStage(host);stage.setPixelRatio(1);stage.setGhosts(false);
      const mapping=createSpatialMapping();
      // Pre-register in the same chronological order as the normal scene.
      for(let m=0;m<=120;m++)mapping.frame(history.baseline[m].state,history.plan[m].state);
      const projected=frames.map(f=>mapping.frame(f.baseline.state,f.plan.state));
      const all={a:projected.flatMap(p=>p.a),b:projected.flatMap(p=>p.b)};
      stage.update(all,null);
      const canvas=document.createElement('canvas');canvas.width=640;canvas.height=420;canvas.setAttribute('aria-label',`Static clip preview, seed ${seed}, Month ${month}. Synthetic modeled results.`);canvas.style.cssText='width:100%;max-width:640px;height:auto';
      const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas export unavailable');
      const pixels=[];
      for(const projection of projected){
        if(disposed)return;
        stage.update(projection,null);ctx.fillStyle='#101e2a';ctx.fillRect(0,0,640,420);ctx.drawImage(host.querySelector('canvas'),0,0);
        ctx.fillStyle='#ffffff';ctx.font='16px monospace';
        const lines=['One City, Two Futures · Synthetic modeled results',`Seed ${seed} · Month ${projection.month} · ${model}`,`Run ${run}`,'Source: recomputation · future-machine-synthetic.v1','Schematic layout · held frames · muted · uncalibrated'];
        lines.forEach((line,i)=>ctx.fillText(line,12,302+i*23,616));
        pixels.push(palettePixels(ctx.getImageData(0,0,640,420).data));
        // Yield between snapshots; never touch the application clock or stage.
        await new Promise(resolve=>setTimeout(resolve,0));
      }
      const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!png)throw Error('Static export unavailable');
      if(disposed)return;
      preview.append(canvas);still.href=url(png);still.download=`future-seed-${seed}-month-${month}.png`;still.hidden=false;
      try{download.href=url(new Blob([encodeGIF(640,420,pixels)],{type:'image/gif'}));download.download=`future-seed-${seed}-month-${month}.gif`;download.hidden=false;play.hidden=false;status.textContent=`Ready: Months ${frames[0].month}–${month}. Static preview; animation plays only on request.`;}
      catch{status.textContent='GIF unavailable. Download the static PNG fallback.';}
    }catch{status.textContent='Clip unavailable: a complete identified comparison and Canvas2D are required. Run or reopen a comparison and retry.';}
    finally{stage?.dispose();host?.remove();busy=false;if(!disposed)prepare.disabled=!getContext().ready;}
  };
  play.onclick=()=>{const image=new Image();image.alt='Ten-second muted replay. Synthetic modeled results; held monthly frames.';image.style.cssText='width:100%;max-width:640px';image.src=download.href;preview.replaceChildren(image);};
  return {update({ready}){prepare.disabled=busy||!ready;},dispose(){disposed=true;clear();panel.remove();}};
}
