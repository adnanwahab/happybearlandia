import {PATRONS,createBarState,sayLine} from '../bar/bar-model.js';
import {findVenueFootprint,venueSceneGeometry,mountBarScene} from './scene.js';

const $=id=>document.getElementById(id);
const state={venues:[],filtered:[],selected:null,scene:null,session:null,request:0,paused:false,load:null};
const B={south:29.52,west:-95.86,north:30.13,east:-95.02};

function plotPosition(venue,canvas){
  return [22+(venue.lng-B.west)/(B.east-B.west)*(canvas.width-44),
    18+(B.north-venue.lat)/(B.north-B.south)*(canvas.height-36)];
}
function drawAtlas(){
  const canvas=$('atlas'),ratio=Math.min(2,window.devicePixelRatio||1);
  const width=canvas.clientWidth||650,height=canvas.clientHeight||145;
  canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
  const c=canvas.getContext('2d');if(!c)return;
  c.fillStyle='#0b2330';c.fillRect(0,0,canvas.width,canvas.height);
  c.strokeStyle='#3b6773';c.lineWidth=1;for(let i=1;i<8;i++){const x=canvas.width*i/8;c.beginPath();c.moveTo(x,0);c.lineTo(x,canvas.height);c.stroke();}
  for(let i=1;i<4;i++){const y=canvas.height*i/4;c.beginPath();c.moveTo(0,y);c.lineTo(canvas.width,y);c.stroke();}
  c.fillStyle='#9bc1c0';c.font=Math.round(11*ratio)+'px system-ui';c.fillText('Houston area · OSM venues (schematic)',14*ratio,16*ratio);
  for(const venue of state.filtered){const [x,y]=plotPosition(venue,canvas);c.fillStyle=state.selected?.id===venue.id?'#ffcf7a':'#5bc0c3';c.beginPath();c.arc(x,y,state.selected?.id===venue.id?5*ratio:2.2*ratio,0,Math.PI*2);c.fill();}
}
const summary=()=>state.filtered.length+' of '+state.venues.length+' OSM-mapped venues';
function renderList(){
  const query=$('search').value.trim().toLowerCase();
  state.filtered=state.venues.filter(v=>(v.name+' '+v.neighborhood+' '+v.address+' '+v.kind).toLowerCase().includes(query));
  $('catalog-status').textContent=summary()+' · OpenStreetMap records, not an exhaustive/current business census.';
  $('venues').replaceChildren();
  const fragment=document.createDocumentFragment();
  for(const venue of state.filtered.slice(0,500)){
    const button=document.createElement('button');button.type='button';button.dataset.venueId=venue.id;
    button.setAttribute('aria-pressed',String(state.selected?.id===venue.id));
    const title=document.createElement('strong'),detail=document.createElement('small');
    title.textContent=venue.name;detail.textContent=[venue.kind,venue.neighborhood||venue.address].filter(Boolean).join(' · ');
    button.append(title,detail);
    button.addEventListener('click',()=>openVenue(venue));
    fragment.append(button);
  }
  $('venues').append(fragment);
  if(state.filtered.length>500){const small=document.createElement('p');small.textContent='Showing the first 500 matching entries; narrow the search to see others.';$('venues').append(small);}
  drawAtlas();
}

async function openVenue(venue){
  const request=++state.request;state.selected=venue;state.paused=false;state.scene?.destroy();state.scene=null;
  state.session=createBarState(); // Fictional patrons and game rules; no real customer profiles.
  $('venue-title').textContent=venue.name;
  $('venue-source').textContent='Looking up a mapped building footprint near this venue…';
  $('venue-link').replaceChildren();
  const a=document.createElement('a');a.href=venue.sourceUrl;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Open OSM record';$('venue-link').append(a);
  renderList();
  $('patron').replaceChildren(...PATRONS.map(p=>new Option(p.name+' · fictional adult',p.id)));
  const select=$('patron');select.value=PATRONS[0].id;select.disabled=false;
  for(const id of ['rotate-left','rotate-right','pause'])$(id).disabled=false;
  $('talk').querySelector('button[type=submit]').disabled=false;
  $('log').replaceChildren();updateLog();
  let match=null,source='Unable to match a real building footprint; using a schematic exterior.';
  try{
    const url='/api/area?'+new URLSearchParams({lat:venue.lat,lng:venue.lng,radiusM:150,core:1});
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
    try{
      const response=await fetch(url,{signal:controller.signal});
      if(response.ok){const area=await response.json();if(area.source==='osm'){match=findVenueFootprint(venue,area);source=match
        ? 'Sourced building footprint: '+match.confidence+'. Height and interior appearance remain illustrative.'
        : 'No uniquely matched OSM building footprint; schematic exterior only.';}}
    }finally{clearTimeout(timer);}
  }catch{source='Building geometry could not be fetched. The exterior is explicitly illustrative.';}
  if(request!==state.request)return;
  const geometry=venueSceneGeometry(venue,match);
  $('venue-source').textContent=source+' Fictional NPCs and game interactions are not information about the real venue.';
  try{
    state.scene=mountBarScene($('scene'),{venue,geometry,patrons:PATRONS,onPatronSelect:id=>{$('patron').value=id;updateLog();}});
    state.scene.select(select.value);
  }catch(error){$('venue-source').textContent='Canvas scene unavailable: '+error.message+'. The venue listing still works.';}
}

function updateLog(){
  const entries=state.session?.log?.slice(-7)??[];
  $('log').replaceChildren(...entries.map((row,index)=>{
    const li=document.createElement('li');
    li.textContent=index===0&&row.text?.includes('The Honey Pot')
      ? 'You enter an imaginary bar scene with fictional characters.'
      : row.text;
    return li;
  }));
}
$('talk').addEventListener('submit',e=>{
  e.preventDefault();if(!state.session)return;
  const text=$('speech').value.trim();if(!text)return;
  const selected=$('patron').value,result=sayLine(state.session,{targetIds:[selected],text});
  $('speech').value='';
  updateLog();
  if(!result?.ok){const li=document.createElement('li');li.textContent=result.reason||'Conversation unavailable';$('log').append(li);}
});
$('patron').addEventListener('change',()=>state.scene?.select($('patron').value));
$('rotate-left').addEventListener('click',()=>state.scene?.rotate(-.25));
$('rotate-right').addEventListener('click',()=>state.scene?.rotate(.25));
$('pause').addEventListener('click',()=>{state.paused=!state.paused;state.scene?.setPaused(state.paused);$('pause').textContent=state.paused?'Resume scene':'Pause scene';});
$('search').addEventListener('input',renderList);
$('show-list').addEventListener('click',()=>{$('search').value='';renderList();});
$('retry').addEventListener('click',()=>loadCatalog(true));
$('atlas').addEventListener('click',event=>{
  if(!state.filtered.length)return;
  const canvas=$('atlas'),rect=canvas.getBoundingClientRect(),ratio=canvas.width/rect.width,x=(event.clientX-rect.left)*ratio,y=(event.clientY-rect.top)*(canvas.height/rect.height);
  const ranked=state.filtered.map(v=>({v,d:Math.hypot(...(()=>{const [px,py]=plotPosition(v,canvas);return [px-x,py-y]})())})).sort((a,b)=>a.d-b.d);
  if(ranked[0]&&ranked[0].d<=18*ratio)openVenue(ranked[0].v);
});
window.addEventListener('resize',drawAtlas);
window.addEventListener('pagehide',()=>{state.scene?.destroy();state.request++;},{once:true});
async function loadCatalog(force=false){
  $('catalog-status').textContent='Finding OSM-tagged bars and pubs in the Houston area…';
  $('retry').disabled=true;
  try{
    const response=await fetch('/api/houston-bars'+(force?'?refresh=1':''),{cache:'no-store'});
    const result=await response.json();
    if(!response.ok)throw Error(result.error||'Could not fetch venue directory');
    state.venues=Array.isArray(result.venues)?result.venues:[];
    $('catalog-status').textContent=state.venues.length+' source-mapped venues · '+(result.cacheStatus==='stale'?'stale cached data':'OSM data')+' · not exhaustive';
    renderList();
    if(!state.venues.length)$('catalog-status').textContent='No mapped bars were returned. Try again later; no fictional venues were substituted.';
  }catch(error){$('catalog-status').textContent=error.message+' · OpenStreetMap service unavailable. No invented venues are shown.';state.venues=[];renderList();}
  finally{$('retry').disabled=false;}
}
loadCatalog();
