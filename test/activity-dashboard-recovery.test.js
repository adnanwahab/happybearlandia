import {test,expect} from 'bun:test';
import {activityRequest,withHistoryDeadline,mountActivityDashboard} from '../world/activity-dashboard.js';
import {createUIDocument} from './helpers/ui-dom.js';

const sleep=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
const snapshot={mode:'legacy',runId:'run-a',modelVersion:'1',minute:0,peopleCount:10,districts:[{id:'home',label:'Home'}]};
const emptyHistory=()=>({buckets:[],totals:{agentMinutes:0},recentEvents:[],coverage:{},retention:{}});
function fixture(options){const document=createUIDocument(),dashboard=mountActivityDashboard({container:document.body,getSnapshot:()=>snapshot,...options});return{document,dashboard,status:document.querySelector('[role="status"]'),button:label=>document.querySelectorAll('button').find(button=>button.textContent===label)};}

test('Activity deadlines preserve successful values and reject sync, async and stalled failures',async()=>{
 const history=emptyHistory();expect(await activityRequest(()=>history,50)).toBe(history);expect(await withHistoryDeadline(()=>Promise.resolve(history),50)).toBe(history);
 await expect(activityRequest(()=>{throw Error('source failed');},50)).rejects.toThrow('source failed');
 await expect(withHistoryDeadline(()=>Promise.reject(Error('query failed')),50)).rejects.toThrow('query failed');
 await expect(activityRequest(()=>new Promise(()=>{}),5)).rejects.toThrow('Apply filters or reopen Activity to retry');
});

test('Activity retains a request error across updates and permits an explicit retry and reopen',async()=>{
 let emit,calls=0,unsubscribed=0,broken=true;
 const {document,dashboard,status,button}=fixture({getHistory:()=>{calls++;if(broken)throw Error('history source failed');return emptyHistory();},subscribe:listener=>{emit=listener;return()=>unsubscribed++;}});
 try{
  expect(dashboard.isOpen()).toBe(false);await dashboard.open();expect(document.getElementById('world-activity-dashboard')).not.toBeNull();expect(dashboard.isOpen()).toBe(true);
  expect(status.dataset.state).toBe('error');expect(status.textContent).toContain('history source failed');
  emit({...snapshot,minute:1});emit({...snapshot,minute:2});await sleep(550);
  expect(calls).toBe(1);expect(status.dataset.state).toBe('error');
  broken=false;await button('Apply filters').click();expect(calls).toBe(2);expect(status.dataset.state).toBe('empty');
  dashboard.close();expect(dashboard.isOpen()).toBe(false);expect(unsubscribed).toBe(1);await dashboard.open();expect(calls).toBe(3);expect(status.dataset.state).toBe('empty');
 }finally{dashboard.destroy();}
 expect(document.getElementById('world-activity-dashboard')).toBeNull();expect(dashboard.isOpen()).toBe(false);expect(document.head.children).toHaveLength(0);
});

test('Activity comparison failure cancels queued refresh and a new run can recover',async()=>{
 let emit,calls=0,current=snapshot,broken=false;
 const {dashboard,status,button}=fixture({getSnapshot:()=>current,getHistory:()=>{calls++;if(broken)throw Error('comparison failed');return emptyHistory();},subscribe:listener=>{emit=listener;return()=>{};}});
 try{
  await dashboard.open();emit({...snapshot,minute:1});broken=true;await button('Load retained place comparison').click();expect(status.dataset.state).toBe('error');await sleep(550);expect(calls).toBe(2);expect(status.dataset.state).toBe('error');
  broken=false;current={...snapshot,runId:'run-b'};emit(current);await sleep(550);expect(calls).toBe(3);expect(status.dataset.state).toBe('empty');
 }finally{dashboard.destroy();}
});

test('Activity bounds an actual pending history request and ignores its late result',async()=>{
 let finish,stalled=true;
 const {dashboard,status,button}=fixture({getHistory:()=>stalled?new Promise(resolve=>{finish=resolve;}):emptyHistory()});
 try{
  await dashboard.open();expect(status.dataset.state).toBe('error');expect(status.textContent).toContain('timed out');expect(status.textContent).toContain('Apply filters or reopen Activity to retry');
  finish(emptyHistory());await sleep(0);expect(status.dataset.state).toBe('error');
  stalled=false;await button('Apply filters').click();expect(status.dataset.state).toBe('empty');
 }finally{dashboard.destroy();}
},12000);
