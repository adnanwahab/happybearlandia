// Private, bounded, process-local discussion. Capabilities never enter stored run data.
const NOTICE='Unofficial preferences of consenting room participants only. No public representation or mandate.';
const fail=message=>{throw new Error(message);};
export function createCircleService({now=Date.now}={}) {
 const rooms=new Map();
 const token=()=>crypto.randomUUID();
 const clean=()=>{for(const [id,r] of rooms)if(r.expires<=now())rooms.delete(id);};
 const text=(s,max)=>typeof s==='string'&&s.trim().length>0&&s.length<=max?s.trim():fail('Invalid or oversized text');
 return {
  create(pin,consent){clean();if(consent!==true)fail('Consent required');if(rooms.size>=100)fail('Room capacity reached');
   const id=token(),owner=token(),invite=token();
   rooms.set(id,{pin:structuredClone(pin),owner,invite,expires:now()+86400000,members:new Map(),claims:[],closed:false});
   return {id,owner,invite,notice:NOTICE};
  },
  act(id,key,action,body={}) {clean();const r=rooms.get(id);if(!r)fail('Room unavailable or expired');
   if(action==='join') {if(key!==r.invite)fail('Access denied');if(r.closed)fail('Room closed');if(body.consent!==true)fail('Consent required');if(r.members.size>=12)fail('Room full');const member=token();r.members.set(member,{id:token(),vote:null});return {member};}
   const m=r.members.get(key),host=key===r.owner;if(!m&&!host)fail('Access denied');
   if(action==='delete-room'){if(!host)fail('Access denied');rooms.delete(id);return {deleted:true};}
   if(action==='leave'){if(!m)fail('Participant required');r.claims=r.claims.filter(c=>c.author!==m.id);r.members.delete(key);return {deleted:true};}
   if(action==='remove'){const c=r.claims.find(c=>c.id===body.id);if(!c||!host&&c.author!==m?.id)fail('Access denied');r.claims=r.claims.filter(c=>c.id!==body.id);}
   else if(action==='close'){if(!host)fail('Access denied');r.closed=true;}
   else if(action==='claim') {
    if(!m||r.closed)fail('Room closed or participant required');if(body.consent!==true)fail('Consent required');if(r.claims.length>=60)fail('Claim limit reached');
    if(!['pro','con','question'].includes(body.kind))fail('Choose pro, con or question');
    if(!['assertion','opinion','question'].includes(body.classification))fail('Choose assertion, opinion or question');
    const source=body.source||null;
    if(source&&!r.pin.evidence.some(e=>e.id===source))fail('Source does not belong to pinned run');
    if(body.classification==='assertion'&&!source)fail('Factual assertions require a pinned source');
    r.claims.push({id:token(),author:m.id,kind:body.kind,classification:body.classification,text:text(body.text,1000),source});
   } else if(action==='vote') {if(!m||r.closed)fail('Room closed or participant required');if(body.consent!==true)fail('Consent required');if(!['support','oppose','unsure',null].includes(body.preference))fail('Invalid preference');m.vote=body.preference;}
   else if(!['read','remove'].includes(action))fail('Unknown action');
   const tally={support:0,oppose:0,unsure:0};for(const p of r.members.values())if(p.vote)tally[p.vote]++;
   return {pin:structuredClone(r.pin),expires:r.expires,closed:r.closed,notice:NOTICE,claims:structuredClone(r.claims),participants:r.members.size,tally,ownId:m?.id||null,preference:m?.vote||null,host};
  }
 };
}
