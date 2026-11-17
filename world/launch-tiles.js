import {createWorldTiles,indexTilePeople} from './launch-tiles-model.js';
const COLORS={ground:'#28382f',road:'#454c57',sidewalk:'#87908b',lot:'#a59a7d',park:'#487653'};
/** Rendering adapter only: all identities, positions and time come from getFrame. */
export function mountTileView({getFrame=()=>window.hblWorldTileSource?.getFrame(),onSelectPerson=id=>window.hblWorldTileSource?.selectPerson(id),onSelectBuilding=id=>window.hblWorldTileSource?.selectBuilding(id),onClose=()=>{},onVisibility=()=>{},container=document.body}={}){
 const doc=container.ownerDocument,win=doc.defaultView;
 if(!doc.querySelector('link[data-world-tile-style]')){const style=doc.createElement('link');style.rel='stylesheet';style.href=new URL('./launch-tiles.css',import.meta.url).href;style.dataset.worldTileStyle='';doc.head.append(style);}
 const root=doc.createElement('section');root.className='world-tiles';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-label','World tile view');root.setAttribute('aria-modal','true');
 root.innerHTML='<header><h2>Tile view</h2><button type="button" data-zoom="in" aria-label="Zoom into tile map">+</button><button type="button" data-zoom="out" aria-label="Zoom out of tile map">−</button><button type="button" data-fit>Fit map</button><button type="button" data-close aria-label="Close tile view">×</button></header><p data-source>Loading current world…</p><div class="world-tiles-layout"><div class="world-tiles-map"><canvas tabindex="0" role="img" aria-label="Top-down map. Click a tile or use arrow keys to inspect. Plus and minus zoom; drag to pan."></canvas></div><aside class="world-tiles-look" aria-label="Tile contents"><h3>Look at a tile</h3><output aria-live="polite">Select a tile to inspect its actual lots and visible residents.</output><div data-entities></div><p class="tile-help">Arrows inspect adjacent tiles. Drag to pan. + / − zoom. Escape returns to 3D.</p></aside></div>';
 const legend=doc.createElement('div');legend.className='world-tiles-legend';for(const [kind,color] of Object.entries(COLORS)){const span=doc.createElement('span');span.style.setProperty('--tile-color',color);span.textContent=kind;legend.append(span);}root.querySelector('header').after(legend);
 container.append(root);
 const canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d'),source=root.querySelector('[data-source]'),look=root.querySelector('output'),entities=root.querySelector('[data-entities]');
 const abort=new AbortController(),options={signal:abort.signal};
 let opened=false,disposed=false,tiles=null,lastKey=null,lastBuildings=null,people={byCell:new Map(),missing:0},frame={},selection=null,zoom=1,panX=0,panZ=0,width=1,height=1,transform=null,timer=null,restoreFocus=null,drag=null;
 const fit=()=>{zoom=1;panX=0;panZ=0;paint();};
 function refresh(){
  if(!opened||disposed)return;
  try{frame=getFrame()??{};}catch{source.textContent='Current world unavailable. Close and reopen once the scene is ready.';return;}
  if(!tiles||frame.geometryKey!==lastKey||(lastKey==null&&frame.buildings!==lastBuildings)){tiles=createWorldTiles(frame);lastKey=frame.geometryKey;lastBuildings=frame.buildings;selection=null;}
  if(!tiles){source.textContent='World geometry is loading. Tile view uses the same current world, without generating another town.';return;}
  people=indexTilePeople(tiles,frame.people);
  const sourceText=`${frame.mode??'World'} · ${frame.modelVersion??'model version unavailable'} · ${frame.revision??frame.runId??'revision unavailable'} · minute ${Number.isFinite(frame.minute)?frame.minute:'unavailable'} · seed ${frame.seed??'unavailable'} · ${tiles.cellSize.toFixed(1)}m cells. Sidewalk strips are a visual approximation. ${people.missing?people.missing+' unlocated/off-map residents omitted.':''} ${(frame.limitations??[]).join(' ')}`;if(source.textContent!==sourceText)source.textContent=sourceText;
  paint();if(selection!==null)inspect(selection,false);
 }
 function paint(){
  if(!opened||!ctx)return;
  const dpr=Math.min(2,win.devicePixelRatio||1);
  if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#20282c';ctx.fillRect(0,0,width,height);if(!tiles)return;
  const scale=Math.min(width/(tiles.columns+2),height/(tiles.rows+2))*zoom,ox=(width-tiles.columns*scale)/2+panX,oy=(height-tiles.rows*scale)/2+panZ;transform={scale,ox,oy};
  const minCol=Math.max(0,Math.floor(-ox/scale)),maxCol=Math.min(tiles.columns-1,Math.ceil((width-ox)/scale)),minRow=Math.max(0,Math.floor(-oy/scale)),maxRow=Math.min(tiles.rows-1,Math.ceil((height-oy)/scale));
  for(let row=minRow;row<=maxRow;row++)for(let col=minCol;col<=maxCol;col++){const index=row*tiles.columns+col,cell=tiles.cells[index],x=ox+col*scale,y=oy+row*scale;ctx.fillStyle=COLORS[cell.kind];ctx.fillRect(x,y,Math.max(1,scale-.6),Math.max(1,scale-.6));if(cell.buildings.length&&scale>=9){const b=tiles.buildings.get(cell.buildings[0]);ctx.fillStyle='#20252c';ctx.font=`${Math.min(18,scale*.72)}px monospace`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(({home:'⌂',food:'f',work:'w',shop:'s',school:'S',park:'♣'})[b?.kind]??'■',x+scale/2,y+scale/2);}}
  for(const [index,rows]of people.byCell){const row=Math.floor(index/tiles.columns),col=index%tiles.columns;if(row<minRow||row>maxRow||col<minCol||col>maxCol)continue;const x=ox+(col+.5)*scale,y=oy+(row+.5)*scale,r=Math.max(2,Math.min(6,scale*.22));ctx.fillStyle='#ffe5a5';ctx.fillRect(x-r/2,y-r*1.1,r,r);ctx.fillRect(x-r*.75,y,r*1.5,r*1.4);if(rows.length>1&&scale>=15){ctx.fillStyle='#fff';ctx.font='10px monospace';ctx.textAlign='left';ctx.fillText(String(rows.length),x+r,y-r);}}
  if(selection!==null){ctx.strokeStyle='#fff3bb';ctx.lineWidth=2;ctx.strokeRect(ox+(selection%tiles.columns)*scale+1,oy+Math.floor(selection/tiles.columns)*scale+1,Math.max(1,scale-2),Math.max(1,scale-2));}
 }
 function selectAction(label,callback){const button=doc.createElement('button');button.type='button';button.textContent=label;button.addEventListener('click',async()=>{try{await callback();close();}catch(error){look.textContent=error.message??'Selection unavailable.';}},options);entities.append(button);}
 function inspect(index,announce=true){
  if(!tiles||index<0||index>=tiles.cells.length)return;
  const changed=selection!==index;selection=index;const cell=tiles.cells[index],residents=people.byCell.get(index)??[];
  look.textContent=`Tile ${index%tiles.columns}, ${Math.floor(index/tiles.columns)} · ${cell.kind} · ${cell.buildings.length} lot(s) · ${residents.length} visible resident(s). ${cell.roads.length?'Road: '+cell.roads.join(', '):''}`;
  // Preserve keyboard focus across live samples if entity membership has not changed.
  const key=[...cell.buildings,...residents.map(p=>String(p.id))].join('|');
  if(changed||entities.dataset.key!==key){entities.replaceChildren();entities.dataset.key=key;for(const id of cell.buildings){const b=tiles.buildings.get(id);selectAction(`${b?.name??id} · ${b?.kind??'lot'} · inspect`,()=>onSelectBuilding(id));}for(const p of residents){selectAction(`${p.name??p.id} · ${p.doing??p.activity??'current resident'} · inspect`,()=>onSelectPerson(String(p.id)));}if(!entities.children.length){const p=doc.createElement('p');p.textContent='No recorded lot or visible resident on this tile.';entities.append(p);}}
  if(announce)paint();
 }
 const resize=()=>{const bounds=canvas.getBoundingClientRect();width=Math.max(1,bounds.width);height=Math.max(1,bounds.height);paint();};
 const resizeObserver=win.ResizeObserver?new win.ResizeObserver(entries=>{const bounds=entries[0]?.contentRect;if(bounds){width=Math.max(1,bounds.width);height=Math.max(1,bounds.height);paint();}}):null;resizeObserver?.observe(canvas);
 function close(){if(!opened)return;opened=false;win.hblWorldTileViewActive=false;root.hidden=true;clearInterval(timer);timer=null;onVisibility(false);onClose();restoreFocus?.focus?.({preventScroll:true});}
 function open(){if(disposed||opened)return;opened=true;win.hblWorldTileViewActive=true;restoreFocus=doc.activeElement;root.hidden=false;onVisibility(true);resize();refresh();timer=win.setInterval(refresh,200);canvas.focus({preventScroll:true});}
 root.querySelector('[data-close]').addEventListener('click',close,options);
 root.querySelector('[data-fit]').addEventListener('click',fit,options);
 const changeZoom=delta=>{zoom=Math.max(.5,Math.min(12,zoom*delta));paint();};
 root.querySelector('[data-zoom=in]').addEventListener('click',()=>changeZoom(1.4),options);root.querySelector('[data-zoom=out]').addEventListener('click',()=>changeZoom(1/1.4),options);
 root.addEventListener('keydown',event=>{if(event.key==='Tab'){const items=[...root.querySelectorAll('button,canvas')].filter(n=>!n.disabled&&n.getClientRects().length),first=items[0],last=items.at(-1);if(event.shiftKey&&doc.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&doc.activeElement===last){event.preventDefault();first?.focus();}}if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();return;}if(event.target!==canvas)return;const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-(tiles?.columns??1),ArrowDown:tiles?.columns??1}[event.key];if(delta!==undefined&&tiles){event.preventDefault();event.stopPropagation();inspect(Math.max(0,Math.min(tiles.cells.length-1,(selection??Math.floor(tiles.cells.length/2))+delta)));}if(event.key==='+'||event.key==='='){event.preventDefault();changeZoom(1.4);}if(event.key==='-'){event.preventDefault();changeZoom(1/1.4);}},options);
 canvas.addEventListener('pointerdown',event=>{if(event.button!==0)return;canvas.focus();drag={id:event.pointerId,x:event.clientX,y:event.clientY,panX,panZ,moved:false};canvas.setPointerCapture(event.pointerId);},options);
 canvas.addEventListener('pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(Math.hypot(dx,dy)>5)drag.moved=true;if(drag.moved){panX=drag.panX+dx;panZ=drag.panZ+dy;paint();}},options);
 canvas.addEventListener('pointerup',event=>{if(!drag||drag.id!==event.pointerId)return;const previous=drag;drag=null;if(!previous.moved&&tiles&&transform){const rect=canvas.getBoundingClientRect(),col=Math.floor((event.clientX-rect.left-transform.ox)/transform.scale),row=Math.floor((event.clientY-rect.top-transform.oy)/transform.scale);if(col>=0&&row>=0&&col<tiles.columns&&row<tiles.rows)inspect(row*tiles.columns+col);}},options);
 canvas.addEventListener('pointercancel',()=>{drag=null;},options);
 canvas.addEventListener('wheel',event=>{event.preventDefault();changeZoom(event.deltaY<0?1.12:1/1.12);},{...options,passive:false});
 win.addEventListener('resize',resize,options);win.addEventListener('pagehide',()=>api.dispose(),{...options,once:true});
 const api={open,close,toggle:()=>opened?close():open(),isOpen:()=>opened,dispose(){if(disposed)return;close();disposed=true;resizeObserver?.disconnect();abort.abort();root.remove();}};return api;
}
