import {recentContext} from './recent.js';

export const BOOKMARK_KEY='hbl.future-machine.bookmarks.v1';
const fail=()=>{throw new Error('Bookmarks are corrupt or expired. Remove all bookmarks to start again.');};
export function validateBookmarks(value){
  if(!Array.isArray(value)||value.length>50)fail();
  return value.map(row=>{
    if(!row||Object.keys(row).sort().join(',')!=='checkpoint,entity,experimentId,label,month,recipe'||typeof row.label!=='string'||!row.label.trim()||row.label.length>80)fail();
    const context=recentContext({recipe:row.recipe,experimentId:row.experimentId,month:row.month});
    if(!context.experimentId||row.checkpoint!==`monthly-city:${context.month}`)fail();
    const e=row.entity;
    if(e!==null&&(!e||Object.keys(e).sort().join(',')!=='arm,collection,id'||!['baseline','plan'].includes(e.arm)||!['buildings','households','units','projects','districts','links'].includes(e.collection)||typeof e.id!=='string'||!e.id.length||e.id.length>200))fail();
    return {...context,label:row.label.trim(),checkpoint:row.checkpoint,entity:e?{...e}:null};
  });
}
export function readBookmarks(storage){const raw=storage.getItem(BOOKMARK_KEY);if(raw===null)return [];if(raw.length>100000)fail();try{return validateBookmarks(JSON.parse(raw));}catch{fail();}}
export function saveBookmarks(storage,rows){const valid=validateBookmarks(rows);storage.setItem(BOOKMARK_KEY,JSON.stringify(valid));return valid;}
// A checkpoint here is a monthly locator in the saved manifest, never a stored snapshot claim.
export function bookmarkScene(history,row){
  if(history.experimentId!==row.experimentId||JSON.stringify(recentContext({recipe:history.recipe,experimentId:history.experimentId,month:row.month}))!==JSON.stringify(recentContext({recipe:row.recipe,experimentId:row.experimentId,month:row.month})))throw new Error('Bookmark run identity unavailable.');
  for(const arm of ['baseline','plan'])if(history[arm]?.[row.month]?.month!==row.month)throw new Error('Bookmark month unavailable.');
  if(row.entity&&!history[row.entity.arm][row.month].state?.[row.entity.collection]?.some(e=>e.id===row.entity.id))throw new Error('Bookmark entity unavailable at this month.');
}
