import { createRoutineDraft, runRoutine, ROUTINE_ACTIONS } from './routine-planner.js';
import { HOUSE_ACTIONS } from './model.js';

export async function mountRoutinePlanner(container, { runtime, entry, record }) {
  runtime.pause();
  const checkpoint = structuredClone(record.save.checkpoint);
  const snapshot = runtime.getSnapshot();
  const draft = createRoutineDraft({ members: entry.members, stepMinutes: snapshot.runtime.stepMinutes });
  const doc = container.ownerDocument;
  const make = (tag, text) => { const node = doc.createElement(tag); if (text != null) node.textContent = text; return node; };
  const root = make('main'); root.className = 'house-chooser';
  const title = make('h1', 'Plan a better week');
  const back = make('a', 'Return to household'); back.href = '/world/house/' + encodeURIComponent(entry.householdId) + '?experiment=' + encodeURIComponent(record.id);
  const notice = make('p', `Synthetic Population experiment · pinned run ${record.id} · ${snapshot.modelVersion} · seed ${snapshot.config.seed} · minute ${snapshot.minute}. Editing does not advance time. Rerun always restores this pin.`);
  const limits = make('p', 'One household task at a time. Drag a task onto a day, or use the form and Add task button with keyboard or touch. Existing work, needs, age, travel and object constraints can reject a task at run time. Listed costs are estimates; actual costs and rejection reasons appear in the run receipt. No causal effect estimate. Draft edits are local to this page.');
  const budget = await runtime.inspectHousehold(entry.householdId);
  notice.append(make('span', ` · starting savings ${budget.savings ?? budget.budget?.savings ?? 'unavailable'}`));
  const form = make('form'); form.style.cssText='display:grid;gap:8px;max-width:100%';
  const field = (label, control) => { const node = make('label', label + ' '); control.style.cssText='max-width:100%;box-sizing:border-box'; node.style.cssText='display:grid;gap:4px;min-width:0'; node.append(control); form.append(node); return control; };
  const select = (values) => { const node = make('select'); for (const [value,text] of values) { const option = make('option',text); option.value = value; node.append(option); } return node; };
  const person = field('Resident', select(entry.members.map(id => [id,id])));
  const type = field('Task', select(ROUTINE_ACTIONS.map(type => [type, `${type} · ${HOUSE_ACTIONS[type].durationMinutes} min · ${type === 'cook' ? '6 per serving (actual roster at admission)' : '0 cash'}`])));
  const day = field('Day', select(Array.from({length:7},(_,i)=>[String(i),`Day ${i+1}`])));
  const minute = field('Minutes after day start', make('input')); minute.type='number'; minute.min='0'; minute.max='1439'; minute.step=String(snapshot.runtime.stepMinutes); minute.value='0';
  const add = make('button','Add task'); add.type='submit'; form.append(add);
  const undo = make('button','Undo last edit'); undo.type='button';
  const run = make('button','Run week from pinned checkpoint'); run.type='button';
  const status = make('p'); status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
  const palette = make('section'); palette.style.cssText='display:flex;flex-wrap:wrap;gap:8px'; palette.setAttribute('aria-label','Draggable tasks');
  for (const action of ROUTINE_ACTIONS) {
    const button=make('button',action); button.type='button'; button.draggable=true;
    button.addEventListener('click',()=>{type.value=action;minute.focus();});
    button.addEventListener('dragstart',event=>{event.dataTransfer.setData('text/plain',JSON.stringify({type:action}));});
    palette.append(button);
  }
  const grid=make('section');grid.setAttribute('aria-label','Weekly schedule');grid.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px';
  const results=make('section');results.setAttribute('aria-label','Run receipt');
  root.append(title,back,notice,limits,palette,form,undo,run,status,grid,results);container.replaceChildren(root);
  let busy=false;
  function change(fn) { if(busy)return;try{fn();results.replaceChildren();status.textContent='Draft updated. Household state unchanged.';render();}catch(error){status.textContent=error.message;} }
  function insert(action, d, index) {
    const offset=Number(d)*1440+Number(minute.value);
    if (!minute.value || Number(minute.value)<0 || Number(minute.value)>=1440) throw Error('Choose minutes 0–1439');
    const blocks=draft.blocks;
    if(index!=null){if(!blocks[index])throw Error('Unknown routine block');blocks[index]={...blocks[index],offset};}
    else blocks.push({personId:person.value,type:action,offset});
    draft.replace(blocks);
  }
  function render() {
    undo.disabled=busy||!draft.canUndo;run.disabled=busy;add.disabled=busy;grid.replaceChildren();
    for(let d=0;d<7;d++){
      const column=make('section'); column.style.cssText='border:1px solid currentColor;padding:8px;min-width:0';column.append(make('h2',`Day ${d+1}`));
      column.addEventListener('dragover',event=>event.preventDefault());
      column.addEventListener('drop',event=>{event.preventDefault();change(()=>{const payload=JSON.parse(event.dataTransfer.getData('text/plain'));insert(payload.type,d,payload.index);});});
      draft.blocks.forEach((block,index)=>{if(Math.floor(block.offset/1440)!==d)return;
        const card=make('article');card.draggable=true;card.style.cssText='border-left:4px solid #87689b;padding:8px;overflow-wrap:anywhere';
        card.append(make('p',`${block.type} · minute ${block.offset%1440} · ${HOUSE_ACTIONS[block.type].durationMinutes} min · ${block.personId}`));
        card.addEventListener('dragstart',event=>event.dataTransfer.setData('text/plain',JSON.stringify({index})));
        const remove=make('button','Remove task');remove.type='button';remove.disabled=busy;remove.addEventListener('click',()=>change(()=>draft.replace(draft.blocks.filter((_,i)=>i!==index))));
        const move=make('button','Move task to selected day and minute');move.type='button';move.disabled=busy;move.addEventListener('click',()=>change(()=>insert(null,day.value,index)));
        card.append(move,remove);column.append(card);
      });grid.append(column);
    }
  }
  form.addEventListener('submit',event=>{event.preventDefault();change(()=>insert(type.value,day.value));});
  undo.addEventListener('click',()=>change(()=>draft.undo()));
  run.addEventListener('click',async()=>{
    if(busy)return;busy=true;render();status.textContent='Running seven modeled days…';results.replaceChildren();
    try{
      const report=await runRoutine(runtime,{checkpoint,householdId:entry.householdId,members:entry.members,runId:record.id,blocks:draft.blocks});
      results.append(make('h2','Synthetic run receipt'),make('p',`Final minute ${runtime.getSnapshot().minute} · household savings ${report.household.savings??report.household.budget?.savings??'unavailable'}. Accepted means admitted, not necessarily completed.`));
      for(const receipt of report.receipts)results.append(make('p',`${receipt.block.type} at minute ${receipt.minute}: ${receipt.accepted?'Accepted · cost '+receipt.cost+' · action '+receipt.result.actionId:'Rejected · '+receipt.reason}`));
      status.textContent='Week complete. Rerun uses the same checkpoint and plan. Undo remains available.';
    }catch(error){status.textContent=error.message;}finally{busy=false;render();}
  });
  render();
  doc.defaultView.addEventListener('pagehide',()=>runtime.destroy(),{once:true});
}
