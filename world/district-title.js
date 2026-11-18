// Presentation-only: these bounds come from the active Population context.
// 8m hysteresis and 700ms dwell are UI assumptions, never district/model rules.
export function createDistrictArrival({dwellMs=700,margin=8}={}) {
  let current=null,candidate=null,since=0;
  const contains=(b,p,pad=0)=>b&&[b.minX,b.maxX,b.minZ,b.maxZ,p?.x,p?.z].every(Number.isFinite)&&b.minX<b.maxX&&b.minZ<b.maxZ&&p.x>=b.minX-pad&&p.x<=b.maxX+pad&&p.z>=b.minZ-pad&&p.z<=b.maxZ+pad;
  return {reset(){current=null;candidate=null;},update({context,point,now}){
    if(!context?.id||!Number.isFinite(now)){this.reset();return null;}
    const districts=context.districts||[];
    const old=districts.find(d=>JSON.stringify([context.id,d.id])===current);
    if(old&&contains(old.bounds,point,margin)){candidate=null;return null;}
    const district=districts.find(d=>typeof d.id==='string'&&typeof d.name==='string'&&d.name.trim()&&contains(d.bounds,point));
    if(!district){candidate=null;return null;}
    const key=JSON.stringify([context.id,district.id]);
    if(key!==candidate){candidate=key;since=now;return null;}
    if(now-since<dwellMs)return null;
    current=key;candidate=null;return district;
  }};
}
export function mountDistrictTitle({container,getFrame,getPoint}) {
  const doc=container.ownerDocument,root=doc.createElement('div'),style=doc.createElement('style');
  root.className='district-title';root.hidden=true;root.setAttribute('role','status');root.setAttribute('aria-live','polite');root.setAttribute('aria-atomic','true');
  style.textContent='.district-title{position:fixed;top:22%;left:50%;transform:translateX(-50%);z-index:35;box-sizing:border-box;width:max-content;max-width:calc(100vw - 32px);padding:14px 20px;border:1px solid #b7d8bd;border-radius:12px;background:#10251ff2;color:#f2fff5;font:15px/1.5 system-ui;text-align:center;pointer-events:none}.district-title strong{display:block;font-size:22px}.district-title[hidden]{display:none}';
  container.append(style,root);const arrival=createDistrictArrival();let expires=0,destroyed=false;
  return {update(now){
    if(destroyed)return;
    const frame=getFrame();
    if(!frame?.context||!Number.isFinite(frame.minute)){arrival.reset();root.hidden=true;root.replaceChildren();return;}
    const district=arrival.update({context:frame.context,point:getPoint(),now});
    if(district){
      const minute=Math.floor(frame.minute),day=Math.floor(minute/1440)+1,hour=Math.floor(((minute%1440)+1440)%1440/60),min=((minute%60)+60)%60;
      const title=doc.createElement('strong'),detail=doc.createElement('span');title.textContent=district.name;
      detail.textContent=`Modeled day ${day} · ${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')} · Synthetic Population partitions and residents · Geometry: ${frame.context.provenance?.geometrySource||'unavailable'}`;
      root.replaceChildren(title,detail);root.hidden=false;expires=now+4500;
    }else if(now>=expires)root.hidden=true;
  },destroy(){destroyed=true;arrival.reset();root.remove();style.remove();}};
}
