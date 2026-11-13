import {densityColor,densityLegend} from './density.js';
/** Canvas2D needs no GPU. The enclosing 3D Living City still requires WebGPU. */
export function mountPopulationDensity(container){
  const doc=container.ownerDocument,root=doc.createElement('section');root.hidden=true;
  root.innerHTML='<h3>Citywide resident density</h3><label>Density legend <select aria-label="Density legend"><option value="weighted">Weighted cohorts</option><option value="explicit">Explicit residents</option></select></label><canvas width="320" height="320" role="img" aria-label="Citywide population density tiles" style="width:100%;max-width:320px;image-rendering:pixelated"></canvas><p role="status"></p>';
  container.append(root);const select=root.querySelector('select'),canvas=root.querySelector('canvas'),status=root.querySelector('p'),ctx=canvas.getContext('2d');let field=null,active=false;
  function draw(){root.hidden=!active;if(!active)return;status.textContent=densityLegend(field,select.value);canvas.hidden=!field||!ctx;if(!ctx){status.textContent+=' Canvas2D unavailable; map disabled.';return;}ctx.clearRect(0,0,320,320);if(!field)return;const values=select.value==='weighted'?field.weighted:field.explicit,max=Math.max(0,...values),step=320/field.size;values.forEach((count,i)=>{ctx.fillStyle=densityColor(count,max);ctx.fillRect(i%field.size*step,Math.floor(i/field.size)*step,step,step);});canvas.setAttribute('aria-label',status.textContent);}
  select.addEventListener('change',draw);
  return{update(next){field=next?.density||null;draw();},setActive(value){active=value;draw();},destroy(){select.removeEventListener('change',draw);root.remove();}};
}
