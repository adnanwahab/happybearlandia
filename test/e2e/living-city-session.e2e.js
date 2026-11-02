import {test,expect} from '@playwright/test';
const harness='<!doctype html><meta charset="utf-8"><title>Actual local session components</title><main></main>';
async function mount(page,id){
 await page.route('**/__living-session-test',r=>r.fulfill({contentType:'text/html',body:harness}));
 await page.goto('/__living-session-test');
 await page.evaluate(async id=>{
  const {createDecisionSession}=await import('/world/population/session.js');
  const {mountSessionView}=await import('/world/population/session-view.js');
  window.session=createDecisionSession({sessionId:'browser-local-session',clientId:id});window.followed=[];window.tasks=[];
  window.sessionView=mountSessionView({container:document.querySelector('main'),session:window.session,getViewpoint:()=>({position:[4,5,6],target:[1,2,3]}),onFollowViewpoint:(view,event)=>window.followed.push({view,event}),onExperimentTask:task=>window.tasks.push(task)});
 },id);
 await page.locator('summary').click();
}
test('real same-origin tabs share annotations/questions and follow only live presenter views',async({context,page})=>{
 await mount(page,'presenter');const other=await context.newPage();await mount(other,'participant');
 await page.getByRole('button',{name:'Present this tab',exact:true}).click();
 await expect(other.locator('[data-participants]')).toContainText('Presenter presenter');
 await other.getByLabel('Follow presenter', {exact:true}).check();
 await page.getByRole('button',{name:'Share current view',exact:true}).click();
 await expect.poll(()=>other.evaluate(()=>window.followed.length)).toBe(1);
 expect(await other.evaluate(()=>window.followed[0].view.target)).toEqual([1,2,3]);
 await page.getByLabel('Target ID',{exact:true}).fill('district-1');
 await page.getByLabel('Annotation',{exact:true}).fill('<img src=x onerror="window.bad=true"> Transit access assumption');
 await page.getByRole('button',{name:'Pin annotation',exact:true}).click();
 await expect(other.locator('[data-annotations]')).toContainText('Transit access assumption');
 expect(await other.evaluate(()=>Boolean(window.bad))).toBe(false);
 await other.getByLabel('Behavioral question',{exact:true}).fill('What changes commute time for this district?');
 await other.getByRole('button',{name:'Queue question',exact:true}).click();
 await expect(page.locator('[data-questions]')).toContainText('What changes commute time');
 await page.getByRole('button',{name:'Propose experiment task',exact:true}).click();
 expect(await page.evaluate(()=>window.tasks[0])).toMatchObject({status:'proposed',approvalRequired:true});
 const saved=await page.evaluate(()=>window.session.export());
 await other.evaluate(data=>{window.session.import(data);window.session.replay(()=>{});},saved);
 expect(await other.evaluate(()=>window.followed.length)).toBe(1);
 await other.getByRole('button',{name:'Read session replay',exact:true}).click();
 await expect(other.getByRole('status')).toContainText('No edits, simulations or approvals');
 expect(await other.evaluate(()=>window.session.getState().tasks.length)).toBe(1);
 await other.evaluate(()=>window.session.destroy());await page.evaluate(()=>window.session.destroy());await other.close();
});
test('portable session log is bounded, rejects invalid imports atomically and deduplicates replay',async({page})=>{
 await mount(page,'bounded');
 const result=await page.evaluate(()=>{
  const initial=window.session.export();
  for(let i=0;i<550;i++)window.session.record('milestone',{label:`Actual test event ${i}`});
  const full=window.session.export(),count=full.events.length;
  let rejected=false;try{window.session.import({...full,events:[full.events[0],{...full.events[1],type:'execute-arbitrary-code'}]});}catch{rejected=true;}
  const after=window.session.getState().events.length;window.session.import(full);window.session.import({...full,events:[full.events[0],full.events[0]]});
  return{count,after,rejected,dropped:full.dropped,final:window.session.getState().events.length,scope:initial.scope};
 });
 expect(result).toEqual({count:500,after:500,rejected:true,dropped:550-500,final:500,scope:'local-same-origin'});
 await page.evaluate(()=>window.session.destroy());
});
