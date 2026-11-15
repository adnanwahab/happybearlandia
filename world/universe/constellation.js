// Presentation-only layout. Registry identities, routes and card DOM stay intact.
export function constellationLayout(cards, groups, zoom = 1) {
  const scale = Math.max(.75, Math.min(1.5, zoom));
  const families = groups.map((name, i) => {
    const members = cards.filter(card => !card.hidden && card.dataset.category === name);
    return {name, x: (40 + i * 360) * scale, members};
  });
  return {scale, width: 1480 * scale,
    height: Math.max(300, 100 + Math.max(0, ...families.map(f => f.members.length)) * 155) * scale,
    families};
}
export function mountConstellation(host, groups) {
  const doc = host.ownerDocument, viewport = doc.querySelector('.map-window');
  const graphButton = doc.querySelector('#constellation-view'), listButton = doc.querySelector('#list-view');
  const tools = doc.querySelector('.zoom-tools');
  const cards = [...host.querySelectorAll('article')];
  const anchor = doc.createComment('directory location'); host.before(anchor);
  const svg = doc.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.classList.add('map-lines'); svg.setAttribute('aria-hidden','true');
  const labels = groups.map(name => {const h = doc.createElement('h2');h.className='family-title';h.textContent=name;return h;});
  let graph = true, zoom = 1;
  function update() {
    graphButton.setAttribute('aria-pressed',String(graph)); listButton.setAttribute('aria-pressed',String(!graph));
    tools.hidden = !graph; viewport.hidden = !graph; doc.querySelector('#map-help').hidden = !graph;
    if (!graph) {
      anchor.after(host); svg.remove(); labels.forEach(h=>h.remove());
      host.style.cssText=''; cards.forEach(c=>c.style.cssText=''); return;
    }
    viewport.append(host); host.prepend(svg,...labels);
    const layout = constellationLayout(cards,groups,zoom);
    host.style.width=layout.width+'px'; host.style.height=layout.height+'px';
    svg.setAttribute('width',layout.width); svg.setAttribute('height',layout.height);
    svg.replaceChildren();
    layout.families.forEach((family,i)=>{
      const label=labels[i];label.hidden=!family.members.length; label.style.left=family.x+'px';label.style.top='25px';label.style.fontSize=(17*layout.scale)+'px';
      family.members.forEach((card,j)=>{
        const x=family.x + (j%2 ? 20 : 0), y=(90+j*155)*layout.scale;
        card.style.left=x+'px';card.style.top=y+'px';card.style.transformOrigin='top left';card.style.transform=`scale(${layout.scale})`;
        const path=doc.createElementNS(svg.namespaceURI,'path');
        path.setAttribute('d',`M ${family.x-12} 60 V ${y+46} H ${x}`);svg.append(path);
      });
    });
    doc.querySelector('#zoom-level').textContent=Math.round(zoom*100)+'%';
    doc.querySelector('#zoom-out').disabled=zoom<=.75;doc.querySelector('#zoom-in').disabled=zoom>=1.5;
  }
  graphButton.addEventListener('click',()=>{graph=true;update();});
  listButton.addEventListener('click',()=>{graph=false;update();});
  for(const [id,delta] of [['zoom-in',.25],['zoom-out',-.25],['zoom-reset',0]]) doc.getElementById(id).addEventListener('click',()=>{
    zoom=delta ? Math.max(.75,Math.min(1.5,zoom+delta)) : 1; update();
  });
  // Native focus order remains registry order. Reveal offscreen links instantly.
  host.addEventListener('focusin',event=>{if(graph) event.target.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});});
  update(); return {update};
}
