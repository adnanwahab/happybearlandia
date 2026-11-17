/** Session-local progress: only explicit exploration callbacks advance the quest. */
export function createDiscoveryQuest() {
  let stop=null, completed=[false,false,false];
  return {
    reset(diffs,{userRun=false}={}) {
      const first=diffs.find(row=>row.available&&row.entities?.length);
      stop=first?{month:first.month,entity:{collection:first.entities[0].collection,id:first.entities[0].id}}:null;
      completed=[userRun,false,false];
    },
    visit(month) { if(completed[0]&&stop&&month===stop.month)completed[1]=true; },
    inspect(month,entity) { if(completed[1]&&stop&&month===stop.month&&entity?.collection===stop.entity.collection&&entity?.id===stop.entity.id)completed[2]=true; },
    get state() { return {completed:[...completed],stop:stop?structuredClone(stop):null}; }
  };
}

export function mountDiscoveryQuest(container,{onVisit,onInspect}={}) {
  const doc=container.ownerDocument,root=doc.createElement('section');
  root.className='fm-quest';root.setAttribute('aria-label','Optional discovery quest');
  const title=doc.createElement('strong');title.textContent='Optional quest · Discover the first divergence';
  const toggle=doc.createElement('button');toggle.type='button';toggle.textContent='Hide quest';toggle.setAttribute('aria-expanded','true');
  const body=doc.createElement('div'),list=doc.createElement('ol'),status=doc.createElement('p');status.setAttribute('role','status');
  const items=['Run paired futures with Fork City','Visit the first recorded divergence','Inspect the changed entity'].map(text=>{const item=doc.createElement('li');item.textContent=text;list.append(item);return item;});
  const visit=doc.createElement('button'),inspect=doc.createElement('button');visit.type=inspect.type='button';visit.textContent='Visit first divergence';inspect.textContent='Inspect quest entity';
  visit.addEventListener('click',()=>onVisit?.());inspect.addEventListener('click',()=>onInspect?.());
  toggle.addEventListener('click',()=>{body.hidden=!body.hidden;toggle.textContent=body.hidden?'Show quest':'Hide quest';toggle.setAttribute('aria-expanded',String(!body.hidden));});
  body.append(list,status,visit,inspect);root.append(title,toggle,body);container.append(root);
  return {update({completed,stop},ready){items.forEach((item,i)=>{item.textContent=(completed[i]?'✓ ':'')+['Run paired futures with Fork City','Visit the first recorded divergence','Inspect the changed entity'][i];});visit.disabled=!ready||!completed[0]||!stop;inspect.disabled=!ready||!completed[1]||!stop;const message=completed[2]?'Quest complete · You inspected a recorded model difference.':!completed[0]?'Press Fork City to begin.':!stop?'No recorded entity divergence in this comparison. Try a housing plan.':`Recorded target: Month ${stop.month} · ${stop.entity.collection} ${stop.entity.id}. Synthetic model result.`;if(status.textContent!==message)status.textContent=message;},dispose(){root.remove();}};
}
