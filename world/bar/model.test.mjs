import test from 'node:test';
import assert from 'node:assert/strict';
import {PATRONS, DRINKS, GROUPS, GROUP_LINES, EVENTS} from './content.js';
import {createNight, loadNight, applyAction, getPatronView, getGroupView, getSummary, safeReturnTo, STARTING_BUDGET} from './model.js';

const lineFor = (patron, stage, best = true) => [...patron.rounds[stage].choices].sort((a, b) => best ? b.score - a.score : a.score - b.score)[0];
const act = (state, action) => {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, result.message);
  return result.state;
};
function conversation(patron, best = true, count = 3, initial = createNight()) {
  let state = initial;
  for (const stage of ['opener', 'story', 'flirt'].slice(0, count)) state = act(state, {type: 'talk', patronId: patron.id, lineId: lineFor(patron, stage, best).id});
  return state;
}
const cheapestPaid = [...DRINKS].filter(drink => drink.price > 0).sort((a,b) => a.price - b.price)[0];

test('the playable cast is adult, grouped once, with valid drinks and three complete rounds', () => {
  assert.equal(PATRONS.length, 6);
  const members = GROUPS.flatMap(group => group.memberIds);
  assert.equal(new Set(members).size, 6);
  assert.equal(members.length, 6);
  for (const patron of PATRONS) {
    assert.ok(patron.age >= 25);
    assert.ok(members.includes(patron.id));
    for (const stage of ['opener', 'story', 'flirt']) {
      assert.equal(patron.rounds[stage].choices.length, 4);
      assert.ok(patron.rounds[stage].choices.some(choice => choice.style === 'sincere'));
    }
    assert.ok(patron.drinks.every(id => DRINKS.some(drink => drink.id === id)));
  }
});

test('a valid conversation advances immutably and a stale button cannot repeat it', () => {
  const state = createNight();
  const untouched = JSON.stringify(state);
  const patron = PATRONS[0];
  const action = {type: 'talk', patronId: patron.id, lineId: lineFor(patron, 'opener').id};
  const result = applyAction(state, action);
  assert.equal(result.ok, true);
  assert.equal(JSON.stringify(state), untouched);
  assert.equal(getPatronView(result.state, patron.id).stage, 'story');
  assert.equal(result.reactions[0].patronId, patron.id);
  assert.ok(result.state.patrons[patron.id].chemistry > 0);
  assert.equal(applyAction(result.state, action).ok, false);
});

test('future-stage and unknown conversation actions leave the exact original state untouched', () => {
  const state = createNight();
  for (const action of [
    {type:'talk',patronId:PATRONS[0].id,lineId:lineFor(PATRONS[0], 'flirt').id},
    {type:'talk',patronId:'missing',lineId:'missing'},
    {type:'explode'},
  ]) {
    const result = applyAction(state, action);
    assert.equal(result.ok, false);
    assert.strictEqual(result.state, state);
  }
});

test('listening to each patron’s taste can earn one contact without duplicate farming', () => {
  for (const patron of PATRONS) {
    const state = conversation(patron);
    assert.equal(getPatronView(state,patron.id).canAsk, true);
    const result = applyAction(state,{type:'invite',patronId:patron.id,kind:'contact'});
    assert.equal(result.ok,true);
    assert.equal(result.state.patrons[patron.id].outcome,'contact',patron.name);
    assert.equal(result.state.contacts.length,1);
    assert.equal(applyAction(result.state,{type:'invite',patronId:patron.id,kind:'contact'}).ok,false);
  }
});

test('a strong conversation can end in a date and reports its actual title', () => {
  const patron=PATRONS[0];
  const state=act(conversation(patron),{type:'invite',patronId:patron.id,kind:'date'});
  assert.equal(state.patrons[patron.id].outcome,'date');
  assert.equal(getSummary(state).connections[0].dateTitle,patron.dateTitle);
});

test('asking too soon does not consume the invitation', () => {
  const patron=PATRONS[0], state=createNight();
  const result=applyAction(state,{type:'invite',patronId:patron.id,kind:'contact'});
  assert.equal(result.ok,false);
  assert.equal(state.patrons[patron.id].invited,false);
});

test('a poorly matched conversation receives a real no that cannot be reopened by repeating an ask', () => {
  const patron=PATRONS[0];
  const state=act(conversation(patron,false),{type:'invite',patronId:patron.id,kind:'date'});
  assert.ok(['friends','declined'].includes(state.patrons[patron.id].outcome));
  assert.equal(state.contacts.length,0);
  assert.equal(getPatronView(state,patron.id).canAsk,false);
  assert.equal(applyAction(state,{type:'invite',patronId:patron.id,kind:'contact'}).ok,false);
  assert.equal(applyAction(state,{type:'talk',patronId:patron.id,lineId:lineFor(patron,'opener').id}).ok,false);
});

test('recovery is available after a miss once, preserves the next stage, and cannot buy chemistry', () => {
  const patron=PATRONS.find(p => p.rounds.opener.choices.some(c=>c.score<0));
  assert.ok(patron);
  const state=conversation(patron,false,1);
  const before=getPatronView(state,patron.id);
  assert.equal(before.canRecover,true);
  const next=act(state,{type:'recover',patronId:patron.id});
  const after=getPatronView(next,patron.id);
  assert.equal(after.stage,before.stage);
  assert.equal(after.chemistry,before.chemistry);
  assert.equal(after.rapport,before.rapport+1);
  assert.equal(after.canRecover,false);
  assert.equal(applyAction(next,{type:'recover',patronId:patron.id}).ok,false);
});

test('buying your own drink has an exact receipt and never changes patron interest', () => {
  const state=createNight();
  const next=act(state,{type:'buy',target:'self',drinkId:cheapestPaid.id});
  assert.equal(next.budget,STARTING_BUDGET-cheapestPaid.price);
  assert.equal(next.spent,cheapestPaid.price);
  assert.deepEqual(next.patrons,state.patrons);
  assert.deepEqual(next.purchases[0],{drinkId:cheapestPaid.id,recipientIds:['self'],cost:cheapestPaid.price});
});

test('an accepted gift charges once and grants no romantic progress', () => {
  const patron=PATRONS[0], drink=DRINKS.find(d=>d.price>0&&patron.drinks.includes(d.id));
  const state=createNight();
  const next=act(state,{type:'buy',target:patron.id,drinkId:drink.id});
  assert.equal(next.budget,STARTING_BUDGET-drink.price);
  assert.deepEqual(next.patrons,state.patrons);
  assert.equal(getPatronView(next,patron.id).offered,true);
  const repeat=applyAction(next,{type:'buy',target:patron.id,drinkId:drink.id});
  assert.equal(repeat.ok,false);
  assert.strictEqual(repeat.state,next);
});

test('a declined gift costs nothing, records the answer, and cannot be spammed with another drink', () => {
  const patron=PATRONS.find(p=>DRINKS.some(d=>!p.drinks.includes(d.id)));
  const drink=DRINKS.find(d=>!patron.drinks.includes(d.id));
  const next=act(createNight(),{type:'buy',target:patron.id,drinkId:drink.id});
  assert.equal(next.budget,STARTING_BUDGET);
  assert.equal(next.purchases.length,0);
  assert.equal(next.offers[0].accepted,false);
  assert.equal(applyAction(next,{type:'buy',target:patron.id,drinkId:patron.drinks[0]}).ok,false);
});

test('a group round charges only accepting guests and records each person’s answer', () => {
  let scenario;
  for(const group of GROUPS)for(const drink of DRINKS){
    const count=group.memberIds.filter(id=>PATRONS.find(p=>p.id===id).drinks.includes(drink.id)).length;
    if(count>0&&count<group.memberIds.length&&drink.price>0)scenario={group,drink,count};
  }
  assert.ok(scenario,'At least one shared-table offer has mixed preferences.');
  const {group,drink,count}=scenario;
  const result=applyAction(createNight(),{type:'buy',target:group.id,drinkId:drink.id});
  assert.equal(result.ok,true);
  assert.equal(result.state.spent,count*drink.price);
  assert.equal(result.reactions.length,group.memberIds.length);
  assert.equal(result.state.offers.filter(o=>o.accepted).length,count);
  assert.match(result.message,/not charged/);
});

test('insufficient funds reject an entire order without consuming offers or leaking cash', () => {
  const drink=[...DRINKS].sort((a,b)=>b.price-a.price)[0];
  let state=createNight();
  while(state.budget>=drink.price)state=act(state,{type:'buy',target:'self',drinkId:drink.id});
  const patron=PATRONS.find(p=>p.drinks.includes(drink.id));
  assert.ok(patron);
  const result=applyAction(state,{type:'buy',target:patron.id,drinkId:drink.id});
  assert.equal(result.ok,false);
  assert.strictEqual(result.state,state);
  assert.equal(state.offers.length,0);
  assert.ok(state.budget>=0);
  const water=DRINKS.find(d=>d.price===0);
  assert.equal(applyAction(state,{type:'buy',target:'self',drinkId:water.id}).ok,true);
});

test('group conversations advance through two distinct topics and individual reactions', () => {
  const group=GROUPS[0];
  let state=createNight();
  for(let i=0;i<2;i++){
    const view=getGroupView(state,group.id);
    assert.equal(view.stage,i);
    assert.equal(view.options.length,4);
    const result=applyAction(state,{type:'group-talk',groupId:group.id,lineId:view.options[0].id});
    assert.equal(result.ok,true);
    assert.equal(result.reactions.length,group.memberIds.length);
    assert.deepEqual(result.reactions.map(r=>r.patronId),group.memberIds);
    state=result.state;
  }
  assert.equal(getGroupView(state,group.id).done,true);
  assert.equal(getGroupView(state,group.id).options.length,0);
  assert.equal(state.patrons[group.memberIds[0]].stage,0,'group talk does not replace getting to know someone');
});

test('group lines can land differently with the two people at a table', () => {
  let found=false;
  for(const group of GROUPS)for(const line of GROUP_LINES[group.id].opener.choices){
    const result=applyAction(createNight(),{type:'group-talk',groupId:group.id,lineId:line.id});
    if(new Set(result.reactions.map(r=>r.tone)).size>1)found=true;
  }
  assert.equal(found,true);
});

test('last call freezes the evening while a new night retains saved contacts and resets spending', () => {
  const patron=PATRONS[0];
  let state=act(conversation(patron),{type:'invite',patronId:patron.id,kind:'contact'});
  state=act(state,{type:'buy',target:'self',drinkId:cheapestPaid.id});
  state=act(state,{type:'end-night'});
  assert.equal(state.ended,true);
  assert.equal(applyAction(state,{type:'buy',target:'self',drinkId:cheapestPaid.id}).ok,false);
  const next=act(state,{type:'new-night'});
  assert.equal(next.night,state.night+1);
  assert.deepEqual(next.contacts,state.contacts);
  assert.equal(next.spent,0);
  assert.equal(next.budget,STARTING_BUDGET);
  assert.equal(next.ended,false);
  assert.equal(next.patrons[patron.id].stage,0);
});

test('valid progress, receipts and a new contact survive a JSON save round trip', () => {
  const patron=PATRONS[0];
  let state=act(conversation(patron),{type:'invite',patronId:patron.id,kind:'contact'});
  state=act(state,{type:'buy',target:'self',drinkId:cheapestPaid.id});
  const group=GROUPS[1];
  state=act(state,{type:'group-talk',groupId:group.id,lineId:GROUP_LINES[group.id].opener.choices[0].id});
  assert.deepEqual(loadNight(JSON.stringify(state)),state);
});

test('malformed, future, nonfinite and inconsistent-budget saves reset safely', () => {
  const base=createNight();
  for(const bad of [null,'{broken','[]',{}, {...base,version:99},{...base,budget:-1},{...base,budget:Infinity},{...base,budget:59},{...base,spent:10}]){
    assert.deepEqual(loadNight(bad),base);
  }
});

test('saved purchases must reconcile with the balance and unknown contacts are removed', () => {
  const base=createNight();
  assert.deepEqual(loadNight({...base,spent:6,budget:54,purchases:[{drinkId:'forged',recipientIds:['self'],cost:6}]}),base);
  const restored=loadNight({...base,contacts:[{patronId:'unknown',name:'Injected',kind:'date',night:1}]});
  assert.deepEqual(restored.contacts,[]);
});

test('return navigation retains the household context but rejects external or unrelated destinations', () => {
  const home='/world/house/synthetic-97a996b8-h269?home=home_153207e4ebf0190b241f';
  assert.equal(safeReturnTo(home),home);
  assert.equal(safeReturnTo('/world/house'),'/world/house');
  for(const bad of ['https://evil.example','//evil.example/world/house','/\\evil.example','javascript:alert(1)','/world/bar','/world/house/../../api/delete','/world/house?ok\nBAD',null,{}]){
    assert.equal(safeReturnTo(bad),'/world/house');
  }
});

test('bar events are one-shot stories and never change cash or romantic interest', () => {
  const event=EVENTS[0], state=createNight();
  const action={type:'event',eventId:event.id,choiceId:event.choices[0].id};
  const next=act(state,action);
  assert.equal(next.budget,state.budget);
  assert.deepEqual(next.patrons,state.patrons);
  assert.equal(applyAction(next,action).ok,false);
});

test('accepted dates use each NPC’s answer, never the player’s invitation', () => {
  for (const patron of PATRONS) {
    const talking = conversation(patron);
    assert.notEqual(getPatronView(talking, patron.id).prompt, patron.inviteText);
    const result = applyAction(talking, {type:'invite',patronId:patron.id,kind:'date'});
    assert.equal(result.reactions[0].text, patron.date);
    assert.equal(getPatronView(result.state,patron.id).prompt, patron.date);
  }
});

test('every authored personal line preserves its own callback and reaction', () => {
  for(const patron of PATRONS){
    for(let stageIndex=0;stageIndex<3;stageIndex++){
      const stage=['opener','story','flirt'][stageIndex];
      const before=conversation(patron,true,stageIndex);
      for(const line of patron.rounds[stage].choices){
        const result=applyAction(before,{type:'talk',patronId:patron.id,lineId:line.id});
        assert.equal(result.ok,true);
        assert.equal(result.reactions[0].text,line.response);
        assert.equal(result.state.patrons[patron.id].history.at(-1).text,line.text);
      }
    }
  }
});

test('group callbacks retain separate authored answers for both people across both topics', () => {
  for(const group of GROUPS){
    for(const stage of ['opener','story']){
      const before=stage==='opener'?createNight():act(createNight(),{type:'group-talk',groupId:group.id,lineId:GROUP_LINES[group.id].opener.choices[0].id});
      for(const line of GROUP_LINES[group.id][stage].choices){
        const result=applyAction(before,{type:'group-talk',groupId:group.id,lineId:line.id});
        for(const reaction of result.reactions)assert.equal(reaction.text,line.reactions[reaction.patronId].response);
      }
    }
  }
});

test('accepted drink gifts use the patron’s original thank-you line', () => {
  for(const patron of PATRONS){
    const result=applyAction(createNight(),{type:'buy',target:patron.id,drinkId:patron.favoriteDrink});
    assert.equal(result.reactions[0].text,patron.drinkReply);
  }
});

test('loading a refusal keeps the attempt closed even if an invited flag is missing', () => {
  const patron=PATRONS[0];
  const state=act(conversation(patron,false),{type:'invite',patronId:patron.id,kind:'date'});
  const outcome=state.patrons[patron.id].outcome;
  state.patrons[patron.id].invited=false;
  const restored=loadNight(JSON.stringify(state));
  assert.equal(restored.patrons[patron.id].invited,true);
  assert.equal(getPatronView(restored,patron.id).canAsk,false);
  assert.equal(applyAction(restored,{type:'invite',patronId:patron.id,kind:'contact'}).ok,false);
  const group=GROUPS.find(g=>g.memberIds.includes(patron.id));
  const afterGroup=act(restored,{type:'group-talk',groupId:group.id,lineId:GROUP_LINES[group.id].opener.choices[0].id});
  assert.equal(afterGroup.patrons[patron.id].outcome,outcome);
  assert.equal(afterGroup.patrons[patron.id].chemistry,restored.patrons[patron.id].chemistry);
  assert.equal(afterGroup.patrons[patron.id].rapport,restored.patrons[patron.id].rapport);
});

test('restored conversation stages come from valid ordered history, not a stale counter', () => {
  const patron=PATRONS[0];
  const state=conversation(patron,true,1);
  state.patrons[patron.id].stage=3;
  const restored=loadNight(state);
  assert.equal(getPatronView(restored,patron.id).stage,'story');
  const corrupt=createNight();
  corrupt.patrons[patron.id].history=[{lineId:lineFor(patron,'flirt').id,text:'bad',reaction:'bad',tone:'great'}];
  corrupt.patrons[patron.id].stage=3;
  assert.equal(getPatronView(loadNight(corrupt),patron.id).stage,'opener');
});

test('restored group history cannot jump to the second topic', () => {
  const group=GROUPS[0], state=createNight();
  state.groups[group.id].usedLines=[GROUP_LINES[group.id].story.choices[0].id];
  assert.equal(getGroupView(loadNight(state),group.id).stage,0);
});

test('a saved recovery remains consumed and keeps its authored callback', () => {
  const patron=PATRONS.find(p=>p.rounds.opener.choices.some(c=>c.score<0));
  let state=conversation(patron,false,1);
  state=act(state,{type:'recover',patronId:patron.id});
  const restored=loadNight(JSON.stringify(state));
  assert.deepEqual(restored,state);
  assert.equal(getPatronView(restored,patron.id).canRecover,false);
  assert.equal(restored.patrons[patron.id].history.at(-1).reaction,patron.recoveryReply);
});

test('a purchase receipt restores a missing gift-offer row and prevents another charge', () => {
  const patron=PATRONS[0];
  const state=act(createNight(),{type:'buy',target:patron.id,drinkId:patron.favoriteDrink});
  state.offers=[];
  const restored=loadNight(state);
  assert.equal(restored.offers.length,1);
  assert.equal(restored.offers[0].accepted,true);
  assert.equal(applyAction(restored,{type:'buy',target:patron.id,drinkId:patron.favoriteDrink}).ok,false);
  assert.equal(restored.spent,DRINKS.find(d=>d.id===patron.favoriteDrink).price);
});

test('mixed group receipts and declined offers round-trip without changing charges or answers', () => {
  const group=GROUPS[0];
  const state=act(createNight(),{type:'buy',target:group.id,drinkId:'wine'});
  const restored=loadNight(JSON.stringify(state));
  assert.deepEqual(restored,state);
});

test('settled successful outcomes repair a missing contact record without duplicating contacts', () => {
  const patron=PATRONS[0];
  const state=act(conversation(patron),{type:'invite',patronId:patron.id,kind:'contact'});
  state.contacts=[];
  const restored=loadNight(state);
  assert.equal(restored.contacts.length,1);
  assert.equal(restored.contacts[0].patronId,patron.id);
  assert.deepEqual(loadNight(restored),restored);
});
