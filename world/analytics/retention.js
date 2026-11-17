// Local observations only: no URLs, identities, simulation inputs or network writes.
export const KEY='hbl-retention.v1', CONSENT='hbl-retention-enabled.v1';
export const WEEK=7*86400000, IDLE=30*60000;
export function weekStart(time){const d=new Date(time);d.setUTCHours(0,0,0,0);d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return +d;}
export function excluded(nav){return nav.webdriver===true||nav.doNotTrack==='1'||nav.globalPrivacyControl===true||/bot|crawler|spider|headless|preview|slurp/i.test(nav.userAgent||'');}
export function read(storage,now=Date.now()){
 try{const rows=JSON.parse(storage.getItem(KEY)||'[]');return Array.isArray(rows)?rows.filter(r=>r&&typeof r.id==='string'&&r.id.length<=64&&Number.isFinite(r.start)&&Number.isFinite(r.last)&&r.start<=r.last&&r.last<=now&&r.start>=weekStart(now)-8*WEEK&&typeof r.play==='boolean'&&typeof r.shared==='boolean').slice(-2000):[];}catch{return [];}
}
export function observe({storage,nav,now=Date.now(),kind,idFactory=()=>crypto.randomUUID()}){
 try{
  if(storage.getItem(CONSENT)!=='yes'||excluded(nav)||!['play','shared'].includes(kind))return false;
  const rows=read(storage,now);let session=rows.at(-1);
  if(!session||now-session.last>=IDLE){session={id:idFactory(),start:now,last:now,play:false,shared:false};rows.push(session);}
  session.last=now;session[kind]=true;storage.setItem(KEY,JSON.stringify(rows.slice(-2000)));return true;
 }catch{return false;}
}
export function weekly(rows,start,now=Date.now()){
 const end=start+WEEK,nextEnd=end+WEEK;
 const cohort=rows.filter(r=>r.start>=start&&r.start<end&&r.play);
 const shares=rows.filter(r=>r.start>=start&&r.start<end&&r.shared);
 const returns=r=>rows.some(s=>s.id!==r.id&&s.play&&s.start>=end&&s.start<nextEnd);
 const metric=items=>({numerator:now>=nextEnd?items.filter(returns).length:null,denominator:items.length});
 return {start,end,nextEnd,mature:now>=nextEnd,repeat:metric(cohort),shared:metric(shares)};
}
export function recordRetention(kind){try{return observe({storage:localStorage,nav:navigator,kind});}catch{return false;}}
