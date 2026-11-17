import {indexCityTiles,createTileStream} from './spatial-tiles.js';
export function mountCityTiles(root) {
 let stream=null,source=null,view=null,drag=null;
 root.innerHTML='<h3>Explore the saved city</h3><p>Drag to pan · use + / − to zoom. District summaries remain available while building detail loads.</p><p data-provenance></p><p data-totals></p><button type="button" data-reset>Reset map view</button> <button type="button" data-zoom="0.6" aria-label="Zoom in city map">+</button> <button type="button" data-zoom="1.6" aria-label="Zoom out city map">−</button> <label><input type="checkbox" data-coarse> Summary only</label><p data-stream role="status"></p><canvas width="800" height="320" aria-label="Saved city tiles. Drag to pan; zoom and reset buttons available."></canvas><details><summary>Complete tile inventory</summary><div class="table-wrap"><table><thead><tr><th>Tile</th><th>Layout</th><th>Buildings</th><th>Units</th><th>Households</th><th>Household members</th></tr></thead><tbody></tbody></table></div></details>';
 const $=s=>root.querySelector(s),canvas=$('canvas'),ctx=canvas.getContext('2d'),coarse=$('[data-coarse]');
 coarse.checked=!ctx||(navigator.deviceMemory>0&&navigator.deviceMemory<=2);
 if(!ctx){canvas.hidden=true;coarse.disabled=true;}
 function draw(state){if(!source)return;const ready=state.tiles.filter(t=>t.status==='ready').length,loading=state.tiles.filter(t=>['queued','loading'].includes(t.status)).length,failed=state.tiles.filter(t=>t.status==='error').length;
  $('[data-stream]').textContent=state.summaryOnly?'Summary only · all totals retained':`${ready} ready · ${loading} loading · ${failed} failed · up to 6 detail tiles; all summaries retained`;
  if(!ctx)return;ctx.fillStyle='#102a32';ctx.fillRect(0,0,800,320);const sx=800/(view.maxX-view.minX),sy=320/(view.maxY-view.minY),px=x=>(x-view.minX)*sx,py=y=>(y-view.minY)*sy;
  for(const t of state.tiles){const b=t.bounds,x=px(b.minX),y=py(b.minY),w=(b.maxX-b.minX)*sx,h=(b.maxY-b.minY)*sy;if(x+w<0||x>800||y+h<0||y>320)continue;
   ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.fillStyle=t.schematic?'#23434b':'#224c43';ctx.fillRect(x+2,y+2,w-4,h-4);ctx.strokeStyle='#6e9990';ctx.strokeRect(x+2,y+2,w-4,h-4);
   ctx.fillStyle='#e1bb73';for(const shape of t.shapes){ctx.beginPath();shape.points.forEach(([a,b],i)=>i?ctx.lineTo(px(a),py(b)):ctx.moveTo(px(a),py(b)));ctx.closePath();ctx.fill();}
   ctx.fillStyle='#fff';ctx.font='13px sans-serif';ctx.fillText(`${t.key} · ${t.status}`,x+9,y+20);ctx.fillText(`${t.summary.residents} household members`,x+9,y+39);ctx.fillText(t.schematic?'Schematic district':'Sourced footprint positions',x+9,y+58);ctx.restore();
  }
 }
 function refresh(retry=false){if(stream&&view)stream.update(view,{coarse:coarse.checked,retry:retry===true});}
 function reset(){if(!source)return;const b=source.bounds,pad=30;view={minX:b.minX-pad,minY:b.minY-pad,maxX:b.maxX+pad,maxY:b.maxY+pad};refresh(true);}
 $('[data-reset]').onclick=reset;coarse.onchange=refresh;
 for(const button of root.querySelectorAll('[data-zoom]'))button.onclick=()=>{if(!view)return;const factor=Number(button.dataset.zoom),cx=(view.minX+view.maxX)/2,cy=(view.minY+view.maxY)/2,w=Math.max(20,Math.min(1e7,(view.maxX-view.minX)*factor))/2,h=Math.max(20,Math.min(1e7,(view.maxY-view.minY)*factor))/2;view={minX:cx-w,maxX:cx+w,minY:cy-h,maxY:cy+h};refresh();};
 canvas.onpointerdown=e=>{if(!view)return;drag={x:e.clientX,y:e.clientY,view:{...view}};canvas.setPointerCapture(e.pointerId);};
 canvas.onpointermove=e=>{if(!drag)return;const b=canvas.getBoundingClientRect(),dx=(e.clientX-drag.x)*(drag.view.maxX-drag.view.minX)/b.width,dy=(e.clientY-drag.y)*(drag.view.maxY-drag.view.minY)/b.height;view={minX:drag.view.minX-dx,maxX:drag.view.maxX-dx,minY:drag.view.minY-dy,maxY:drag.view.maxY-dy};refresh();};
 canvas.onpointerup=canvas.onpointercancel=()=>{drag=null;};
 return {update(state,identity={}){stream?.dispose();stream=null;source=null;drag=null;root.hidden=!state;if(!state)return;source=indexCityTiles(state);const p=source.provenance;
  $('[data-provenance]').textContent=`${identity.experimentId} / ${identity.scenarioId} / run ${identity.runIndex} · month ${p.month} · seed ${p.seed} · ${p.model} · ${p.dataset} · ${p.adapter}. Geometry: ${p.geometrySource}; synthetic district layouts where absent. Household-member counts sum saved household sizes, not individual resident records. Units and households are model inventory, not visible avatars or interaction counts.`;
  const t=source.totals;$('[data-totals]').textContent=`Complete saved city: ${t.residents} household members · ${t.households} households · ${t.units} units · ${t.buildings} buildings`;
  $('tbody').replaceChildren(...source.tiles.map(t=>{const tr=document.createElement('tr');for(const value of [t.key,t.schematic?'Schematic':'Geographic',t.summary.buildings,t.summary.units,t.summary.households,t.summary.residents]){const td=document.createElement('td');td.textContent=value;tr.append(td);}return tr;}));
  stream=createTileStream(source,{onChange:draw});reset();
 },destroy(){stream?.dispose();root.replaceChildren();}};
}
