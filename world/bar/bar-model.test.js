import {describe,expect,test} from 'bun:test';
import {BAR_CLOSE_MINUTE,DRINKS,PATRONS,STARTING_CASH,buyDrink,buyGossip,clockLabel,createBarState,drinkById,endNight,judgeLine,leaveWith,nightScore,patronById,patronsInGroup,sayLine,shootShot} from './bar-model.js';
import {createBarJudgeHandler,sanitizeJudgeRequest} from './bar-api.js';
const judged=(ids,score,extra={})=>ids.map(id=>({id,score,style:'absurd',creepy:false,...extra}));
const post=(body,headers={})=>new Request('http://localhost/api/bar/judge',{method:'POST',headers:{'content-type':'application/json',origin:'http://localhost',...headers},body:JSON.stringify(body)});
describe('the room',()=>{
 test('every patron is an adult and both women and men are here',()=>{expect(PATRONS.every(row=>row.age>=21)).toBe(true);expect(new Set(PATRONS.map(row=>row.gender))).toEqual(new Set(['woman','man']));});
 test('every favorite drink is on the menu',()=>{expect(PATRONS.every(row=>drinkById(row.drink))).toBe(true);expect(DRINKS.some(row=>row.price===0&&row.alcohol===0)).toBe(true);});
 test('the clock reads like a bar clock',()=>{expect(clockLabel(21*60)).toBe('9:00 PM');expect(clockLabel(25*60+5)).toBe('1:05 AM');});
});
describe('buying drinks',()=>{
 test('buying for yourself costs money and adds courage',()=>{const state=createBarState();expect(buyDrink(state,{drinkId:'lager'}).ok).toBe(true);expect(state.cash).toBe(STARTING_CASH-6);expect(state.tipsy).toBe(1);});
 test('buying someone their favorite beats any other drink',()=>{const a=createBarState(),b=createBarState();buyDrink(a,{drinkId:'paloma',forIds:['sofia']});buyDrink(b,{drinkId:'lager',forIds:['sofia']});expect(a.patrons.sofia.vibe).toBeGreaterThan(b.patrons.sofia.vibe);});
 test('a round charges per person and warms the group',()=>{const state=createBarState(),ids=patronsInGroup('softball').map(row=>row.id);const result=buyDrink(state,{drinkId:'lager',forIds:ids});expect(result.cost).toBe(18);expect(state.cash).toBe(STARTING_CASH-18);expect(ids.every(id=>state.patrons[id].drinks===1)).toBe(true);});
 test('you cannot overspend',()=>{const state=createBarState();state.cash=5;expect(buyDrink(state,{drinkId:'honeyOld',forIds:['nico']}).ok).toBe(false);expect(state.cash).toBe(5);});
 test('nobody is served past their limit, but water still works',()=>{const state=createBarState();state.patrons.nico.drinks=3;expect(buyDrink(state,{drinkId:'lager',forIds:['nico']}).ok).toBe(false);expect(buyDrink(state,{drinkId:'water',forIds:['nico']}).ok).toBe(true);expect(state.patrons.nico.drinks).toBe(3);});
 test('the player gets cut off and water sobers them up',()=>{const state=createBarState();state.tipsy=6;expect(buyDrink(state,{drinkId:'shot'}).ok).toBe(false);buyDrink(state,{drinkId:'water'});expect(state.tipsy).toBe(5);});
 test('gossip is paid once',()=>{const state=createBarState();buyGossip(state,'dani');buyGossip(state,'dani');expect(state.cash).toBe(STARTING_CASH-2);});
});
describe('talking',()=>{
 test('tastes change how a line lands',()=>{const line='I am legally required to tell you I am a goose in a trench coat.';expect(judgeLine(line,patronById('tobias')).score).toBeGreaterThan(judgeLine(line,patronById('lena')).score);});
 test('a funny line beats a bland one',()=>{const nico=patronById('nico');expect(judgeLine('A tiny wizard lives in my phone and does my texts.',nico).score).toBeGreaterThan(judgeLine('hey',nico).score);});
 test('repeating a line stops working',()=>{const state=createBarState(),line='I am a goose in a trench coat.';sayLine(state,{targetIds:['nico'],text:line});expect(judgeLine(line,patronById('nico'),{usedLines:state.lines}).style).toBe('repeat');});
 test('a group line reaches everyone and laughter spreads',()=>{const state=createBarState(),ids=patronsInGroup('office').map(row=>row.id);const result=sayLine(state,{targetIds:ids,text:'funny',judgements:[...judged(ids.slice(0,2),8),...judged(ids.slice(2),3)]});expect(result.results).toHaveLength(3);expect(state.patrons.jules.vibe).toBe(30+(3-4)*3+4);});
 test('creepy lines cost the group and three strikes get you bounced',()=>{const state=createBarState();for(const id of ['nico','sofia','tobias'])sayLine(state,{targetIds:[id],text:'nice body '+id,judgements:judged([id],0,{creepy:true,style:'creepy'})});expect(state.strikes).toBe(3);expect(state.over).toBe(true);expect(state.ending).toBe('bounced');});
 test('the house judge catches crude lines',()=>{expect(judgeLine('send pics of your body',patronById('nico')).creepy).toBe(true);});
 test('a frozen-out patron stops listening',()=>{const state=createBarState();state.patrons.nico.cold=true;expect(sayLine(state,{targetIds:['nico'],text:'please?'}).ok).toBe(false);});
 test('the bar closes at 2',()=>{const state=createBarState();state.minute=BAR_CLOSE_MINUTE-5;sayLine(state,{targetIds:['nico'],text:'last call joke here'});expect(state.over).toBe(true);expect(state.ending).toBe('closing');});
});
describe('shooting your shot',()=>{
 test('earned vibe gets a number',()=>{const state=createBarState();state.patrons.sofia.vibe=75;expect(shootShot(state,'sofia').status).toBe('yes');expect(state.patrons.sofia.number).toBe(true);expect(nightScore(endNight(state)).numbers).toEqual(['Sofia']);});
 test('too early is a no that costs vibe',()=>{const state=createBarState();expect(shootShot(state,'sofia').status).toBe('notYet');expect(state.patrons.sofia.number).toBe(false);expect(state.patrons.sofia.vibe).toBe(25);});
 test('the bride stays taken no matter how funny you are',()=>{const state=createBarState();state.patrons.priya.vibe=100;expect(shootShot(state,'priya').status).toBe('taken');expect(state.patrons.priya.number).toBe(false);});
 test('nobody says yes while too tipsy, even with high vibe',()=>{const state=createBarState();state.patrons.dani.vibe=100;state.patrons.dani.drinks=3;expect(shootShot(state,'dani').status).toBe('tipsy');expect(state.patrons.dani.number).toBe(false);});
 test('leaving together needs a number and high vibe',()=>{const state=createBarState();state.patrons.nico.vibe=95;expect(leaveWith(state,'nico').ok).toBe(false);shootShot(state,'nico');expect(leaveWith(state,'nico').ok).toBe(true);expect(state.over).toBe(true);expect(nightScore(state).title).toBe('Closing Time Legend');});
});
describe('AI judge',()=>{
 const env={OPENAI_API_KEY:'test-key',OPENAI_MODEL:'test-model'};
 const reply=listeners=>async()=>Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({listeners})}]}]});
 test('only known patrons can be judged, so clients cannot inject profiles',()=>{expect(()=>sanitizeJudgeRequest({text:'hi there',listeners:['nobody']})).toThrow();expect(sanitizeJudgeRequest({text:'hi there',listeners:['nico']}).listeners[0].humorTastes).toBe(patronById('nico').humor);});
 test('without a key it reports unavailable so the game uses the house judge',async()=>{const response=await createBarJudgeHandler({env:{}})(post({text:'hello there friend',listeners:['nico']}));expect(response.status).toBe(503);});
 test('scores are clamped and creepy always means zero',async()=>{const handler=createBarJudgeHandler({env,fetchImpl:reply([{id:'nico',score:99,style:'absurd',creepy:false,reply:'Ha!'},{id:'sofia',score:9,style:'absurd',creepy:true,reply:'No.'}])});const body=await(await handler(post({text:'hello there friend',listeners:['nico','sofia']}))).json();expect(body.judgements[0].score).toBe(10);expect(body.judgements[1].score).toBe(0);expect(body.judgements[1].style).toBe('creepy');});
 test('a bad model answer fails closed',async()=>{const handler=createBarJudgeHandler({env,fetchImpl:reply([{id:'nico',score:'lots'}])});expect((await handler(post({text:'hello there friend',listeners:['nico']}))).status).toBe(502);});
 test('rate limiting holds',async()=>{const handler=createBarJudgeHandler({env,maxPerMinute:1,fetchImpl:reply([{id:'nico',score:5,style:'flat',creepy:false,reply:'Ha'}])});await handler(post({text:'hello there friend',listeners:['nico']}));expect((await handler(post({text:'hello there friend',listeners:['nico']}))).status).toBe(429);});
});
