import {validateRecipe} from './data/index.js';

// Revise the existing policy: v1 recipes intentionally support only one policy.
export function followUpRecipe(input) {
  const recipe=validateRecipe(input), policy=recipe.intervention;
  if(policy?.type!=='housing'||policy.amount<=0||policy.amount>108)return null;
  const amount=policy.amount+12;
  const cost=Math.round(policy.cost*amount/policy.amount);
  try{return validateRecipe({...recipe,intervention:{...policy,amount,cost}});}catch{return null;}
}

export function createFollowUp(root,{onAccept}={}) {
  const doc=root.ownerDocument, panel=doc.createElement('section');
  panel.setAttribute('aria-label','Optional follow-up policy');panel.hidden=true;
  const title=doc.createElement('h2');title.textContent='Try one more housing edit?';
  const detail=doc.createElement('p'),accept=doc.createElement('button'),dismiss=doc.createElement('button');
  accept.type=dismiss.type='button';accept.textContent='Accept and rerun';dismiss.textContent='Keep this result';
  panel.append(title,detail,accept,dismiss);root.append(panel);
  let offer=null,source=null,handled=false,accepted=false;
  function hide(){handled=true;panel.hidden=true;}
  function approve(){if(!offer||accept.disabled)return;const next=offer;accepted=true;hide();onAccept(next);}
  accept.addEventListener('click',approve);dismiss.addEventListener('click',hide);
  return {update({history,month,status}){
    if(history!==source){source=history;handled=false;offer=history?followUpRecipe(history.recipe):null;}
    panel.hidden=accepted||handled||!offer||month!==120||status!=='ready';
    accept.disabled=status!=='ready';
    if(offer){const old=history.recipe.intervention,next=offer.intervention;detail.textContent=`Revise this plan from ${old.amount} to ${next.amount} proposed homes. Added budget: ${(next.cost-old.cost).toLocaleString('en-US')} illustrative USD; total ${next.cost.toLocaleString('en-US')} USD. Authored synthetic budget assumption, scaled at the current cost per proposed home. Rerun from Month 0 with seed ${offer.seed}, the same starting city and 120-month horizon. Only housing amount and budget change. Funding, capacity and construction delays still apply. Compare the revised plan with the same unchanged baseline; this is a policy revision, not an additional simultaneous policy.`;}
  },dispose(){accept.removeEventListener('click',approve);dismiss.removeEventListener('click',hide);panel.remove();}};
}
