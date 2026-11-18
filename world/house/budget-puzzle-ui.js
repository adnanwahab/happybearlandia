import {BUDGET_ACTIONS,BUDGET_SCENARIO,BUDGET_VERSION,startBudget,budgetStep,cancelBudget,replayBudget} from './budget-puzzle.js';
export function mountBudgetPuzzle(container,{source=BUDGET_SCENARIO}={}){
 const doc=container.ownerDocument;
 const root=doc.createElement('main');root.className='house-chooser';container.replaceChildren(root);
 const add=(tag,text,parent=root)=>{const n=doc.createElement(tag);n.textContent=text;parent.append(n);return n;};
 add('h1','One Salary, Seven Days');
 add('p','Synthetic toy puzzle · authored prices and needs, no measured observations. Scripted flavor: make one salary last until Sunday. This puzzle does not change a saved household.');
 add('p',`${BUDGET_VERSION} · ${source?.id??'No source'} · seed ${source?.seed??'unavailable'} · no random draws`);
 add('p','Start: 100 credits and 2 food. Need: 1 food each day. Rent: 40 credits after food on day 7. Win by feeding all seven days and paying rent. A missed need or unpaid rent ends the week.');
 const back=add('a','Back to saved homes');back.href='/world/house';
 const status=add('p','');status.setAttribute('role','status');
 const controls=add('div','');const calendar=add('ol','');calendar.setAttribute('aria-label','Seven-day decision calendar');
 let state;try{state=startBudget(source);}catch(error){status.textContent=error.message;return;}
 function draw(){status.textContent=`Day ${state.day} · ${state.cash} credits · ${state.food} food · ${state.status}. ${state.reason}`;
 controls.replaceChildren();calendar.replaceChildren();
 for(let day=1;day<=7;day++){const row=state.checkpoints.find(c=>c.day===day);const previous=state.checkpoints.find(c=>c.day===day-1)?.actionCount??0;add('li',`Day ${day}: ${row?state.actions.slice(previous,row.actionCount).join(', ')+` → ${row.cash} credits, ${row.food} food · ${row.status}`:day===state.day&&state.status==='playing'?'Awaiting decision':'No committed result'}`,calendar);}
 const button=(label,fn,disabled=false)=>{const b=add('button',label,controls);b.type='button';b.disabled=disabled;b.onclick=()=>{try{fn();draw();}catch(error){status.textContent=error.message;}};};
 for(const [action,rule]of Object.entries(BUDGET_ACTIONS))button(rule.label,()=>{state=budgetStep(state,action);},state.status!=='playing'||state.cash<rule.cost);
 button('Cancel week',()=>{state=cancelBudget(state);},state.status!=='playing');
 button('Verify recorded replay',()=>{state=replayBudget(state);});
 button('Restart matched scenario',()=>{state=startBudget(source);});
 }
 draw();
}
