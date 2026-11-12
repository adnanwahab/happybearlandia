/** Versioned, synthetic, directed, interval-capacitated logistics solver. */
export const VERSION = 'flowmap-logistics/1';
const stable = x => JSON.stringify(x, (_, v) => v && !Array.isArray(v) && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))) : v);
export async function runLogistics(input) {
  if(input.version !== VERSION) throw Error('Unsupported logistics version');
  const {links, demands, intervalHours, context, roadMappings = []} = input;
  if (!(intervalHours > 0) || !Number.isFinite(intervalHours)) throw Error('Positive intervalHours required');
  const ids = new Set();
  for(const l of links) {
    if(ids.has(l.id) || !l.id || !l.from || !l.to) throw Error('Invalid or duplicate link');
    ids.add(l.id);
    for(const k of ['capacityPerHour','hours','costPerUnit']) if(!Number.isFinite(l[k]) || l[k]<0) throw Error(`Invalid ${k}`);
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stable(input)));
  const inputHash = Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  const remaining = new Map(links.map(l=>[l.id,l.closed ? 0 : l.capacityPerHour*intervalHours]));
  const traces = [], deliveries = [];
  for(const d of [...demands].sort((a,b)=>a.id.localeCompare(b.id))) {
    if(!Number.isFinite(d.units) || d.units<0 || d.from===d.to) throw Error('Invalid demand');
    let unserved = d.units, cost = 0, unitHours = 0;
    const shipments=[];
    while(unserved>1e-9) {
      const dist=new Map([[d.from,0]]), paths=new Map([[d.from,[]]]), visited=new Set();
      while(true) {
        const next=[...dist].filter(([n])=>!visited.has(n)).sort((a,b)=>a[1]-b[1] || a[0].localeCompare(b[0]))[0];
        if(!next || next[0]===d.to) break;
        const [node, distance]=next; visited.add(node);
        for(const l of [...links].sort((a,b)=>a.id.localeCompare(b.id))) if(l.from===node && remaining.get(l.id)>1e-9 && !visited.has(l.to)) {
          const weight=l.hours*(1+(1-remaining.get(l.id)/(l.capacityPerHour*intervalHours)));
          if(distance+weight < (dist.get(l.to) ?? Infinity)) {dist.set(l.to,distance+weight); paths.set(l.to,[...paths.get(node),l]);}
        }
      }
      const path=paths.get(d.to); if(!path?.length) break;
      const units=Math.min(unserved,...path.map(l=>remaining.get(l.id)));
      const hours=dist.get(d.to), shipmentCost=units*path.reduce((s,l)=>s+l.costPerUnit,0);
      path.forEach(l=>remaining.set(l.id,remaining.get(l.id)-units));
      shipments.push({linkIds:path.map(l=>l.id),units,hours,cost:shipmentCost});
      cost+=shipmentCost; unitHours+=units*hours; unserved-=units;
    }
    const delivered=d.units-unserved;
    deliveries.push({demandId:d.id,delivered,unserved,cost,meanHours:delivered ? unitHours/delivered : null,shipments});
    traces.push({demandId:d.id,inputHash,context,rule:'sorted-demand residual shortest-time routing; congestion multiplier 1 + used/capacity',closedLinks:links.filter(l=>l.closed).map(l=>l.id),saturatedLinks:links.filter(l=>remaining.get(l.id)<=1e-9).map(l=>l.id),shipments,unserved});
  }
  return {version:VERSION,context,inputHash,intervalHours,classification:'synthetic',units:{volume:'units',capacity:'units/hour',time:'hours',cost:'currency units'},roadMappings:roadMappings.map(m=>({...m,status:m.linkIds?.length && m.linkIds.every(id=>ids.has(id)) ? 'connected' : 'unconnected'})),deliveries,traces};
}
