import {createCase,CLUES} from './case.js';
/** @template {keyof HTMLElementTagNameMap} T
 * @param {string} id @param {T} tag @returns {HTMLElementTagNameMap[T]} */
function element(id,tag){const node=document.getElementById(id);if(!node || node.tagName.toLowerCase()!==tag)throw Error('Missing case control: '+id);return /** @type {HTMLElementTagNameMap[T]} */(node);}
const elements={
  load:element('load','button'),cancel:element('cancel','button'),resume:element('resume','button'),restart:element('restart','button'),photo:element('photo','button'),inspect:element('inspect','button'),
  date:element('date','select'),subject:element('subject','select'),camera:element('camera','input'),hint:element('hint','details'),
  status:element('status','p'),case:element('case','section'),clue:element('clue','h2'),flavor:element('flavor','p'),'hint-text':element('hint-text','p'),caption:element('caption','figcaption'),records:element('records','ul'),progress:element('progress','span'),notebook:element('notebook','ol'),street:document.getElementById('street'),
};
/** @template {keyof typeof elements} K @param {K} id */
const $=id=>elements[id];
let active, controller, generation=0;
const status=message=>{$('status').textContent=message;};
const cp=()=>active?.source.checkpoints.find(c=>c.id===$('date').value);
function draw(){
  const checkpoint=cp();if(!checkpoint)return;
  const x=Number($('camera').value), svg=$('street');svg.replaceChildren();
  const ns='http://www.w3.org/2000/svg';
  const shape=(tag,attrs,text)=>{const el=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,String(v));if(text)el.textContent=text;svg.append(el);};
  shape('rect',{x:0,y:112,width:240,height:38,fill:'#43585b'});
  for(const e of checkpoint.entities){
    shape('rect',{x:e.x-x,y:35,width:e.width,height:77,fill:e.id===$('subject').value?'#edce90':'#e5e1cf',stroke:'#263e43','stroke-width':2});
    shape('text',{x:e.x-x+4,y:57,fill:'#142c33','font-size':8},e.name);
    shape('text',{x:e.x-x+4,y:82,fill:'#142c33','font-size':7},e.label);
  }
  const entity=checkpoint.entities.find(e=>e.id===$('subject').value);
  $('caption').textContent=`${checkpoint.date} · ${checkpoint.id} · camera ${x}–${x+240}. ${entity?.name}: ${entity?.label}.`;
  $('records').replaceChildren(...checkpoint.entities.map(e=>{const li=document.createElement('li');li.textContent=`${e.name} (${e.id}): ${e.label} · ${checkpoint.date} · ${checkpoint.id}`;return li;}));
}
function updateClue(){
  const clue=CLUES[active.progress];$('progress').textContent=`${active.progress} / 3`;
  $('clue').textContent=clue?`Clue ${active.progress+1}: ${clue.prompt}`:'All three clues recorded';
  $('hint-text').textContent=clue?.hint??'Review the notebook for exact source records.';
  $('flavor').textContent=clue?.flavor??'The case conclusion is scripted interpretation of this toy street.';
  $('hint').open=false;$('photo').disabled=$('inspect').disabled=!clue;
}
async function load(){
  const token=++generation;controller?.abort();controller=new AbortController();
  $('load').disabled=true;$('cancel').disabled=false;$('case').hidden=true;active=undefined;$('resume').hidden=true;$('restart').disabled=true;
  $('notebook').replaceChildren();$('progress').textContent='0 / 3';status('Loading pinned source checkpoints…');
  try{
    const response=await fetch('./scenario.json',{signal:controller.signal});
    if(!response.ok)throw Error('No source data. Retry loading the pinned demo.');
    const next=await createCase(await response.json());if(token!==generation)return;active=next;
    $('date').replaceChildren(...active.source.checkpoints.map(c=>new Option(c.date,c.id)));
    $('subject').replaceChildren(...active.source.checkpoints[0].entities.map(e=>new Option(e.name,e.id)));
    $('camera').value='0';$('case').hidden=false;$('restart').disabled=false;$('load').hidden=true;
    updateClue();draw();status('Pinned demo ready. Choose the right checkpoint and frame the subject.');$('clue').focus();
  }catch(error){if(token===generation)status(error.message.startsWith('Replay mismatch')?error.message:'No source data. Retry loading the pinned demo.');}
  finally{if(token===generation){$('load').disabled=false;$('cancel').disabled=!active;}}
}
$('load').onclick=load;
$('cancel').onclick=()=>{++generation;controller?.abort();active?.cancel();$('case').hidden=true;$('load').disabled=false;$('cancel').disabled=true;$('resume').hidden=!active;status('Investigation cancelled. No new evidence recorded.');(active?$('resume'):$('load')).focus();};
$('resume').onclick=()=>{active?.resume();$('case').hidden=false;$('resume').hidden=true;$('cancel').disabled=false;status('Case resumed. Earned evidence retained.');$('clue').focus();};
$('restart').onclick=()=>{active?.restart();$('notebook').replaceChildren();$('case').hidden=false;$('resume').hidden=true;$('cancel').disabled=false;updateClue();status('Case restarted. Local evidence cleared; source checkpoints unchanged.');$('clue').focus();};
for(const id of /** @type {const} */ (['date','subject']))$(id).onchange=draw;
$('camera').oninput=draw;
for(const mode of /** @type {const} */ (['photo','inspect']))$(mode).onclick=()=>{
  const result=active?.capture({checkpointId:$('date').value,entityId:$('subject').value,cameraX:Number($('camera').value),mode});if(!result)return;
  status(result.message);
  if(result.ok){const r=result.receipt,li=document.createElement('li');li.textContent=`Clue ${r.clue} · ${r.label} · ${r.date} · ${r.entityId} · ${r.checkpointId} · ${r.runId} · seed ${r.seed} · ${r.rulesVersion} · ${r.source} · ${r.mode==='photo'?'camera framing checked':'text record inspected'}`;$('notebook').append(li);updateClue();$('clue').focus();}
};
