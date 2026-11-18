const groups=['Worlds & people','Decisions & experiments','Tools & analysis','Play & discover'];
const groupFor=app=>['worlds','living'].includes(app.category)?groups[0]:app.category==='games'?groups[3]:app.category==='science'?groups[2]:groups[1];
const host=document.querySelector('.routes'),fallback=[...host.querySelectorAll('article')];
const input=document.querySelector('#search'),filters=document.querySelector('.filters');
const favoriteKey='hbl-directory-favorites',legacyOptimization='/world/decision.html?demo=1#advanced',optimization='/world/decision.html#advanced';
let catalogError=false,experienceCount=0,catalogTimer;

try{
 const {EXPERIENCES}=await Promise.race([
  import('./registry.js'),
  new Promise((_,reject)=>{catalogTimer=setTimeout(()=>reject(new Error('Catalog loading deadline exceeded')),3000);}),
 ]);
 const fragment=document.createDocumentFragment();
 for(const app of EXPERIENCES){
  const card=document.createElement('article'),title=document.createElement('h2'),description=document.createElement('p'),link=document.createElement('a'),code=document.createElement('code');
  card.dataset.experienceId=app.id;card.dataset.category=groupFor(app);
  title.textContent=app.title;description.textContent=app.description||`Explore ${app.title}.`;
  link.href=app.route;link.textContent=`Open ${app.title} →`;code.textContent=app.route;
  card.append(title,description,link);
  if(app.id==='future-machine'){
   const demo=document.createElement('a');demo.href='/world/future-machine.html?demo=1';demo.textContent='Play 50-second demo →';card.append(demo);
  }
  const previous=fallback.find(row=>row.querySelector('a').getAttribute('href')===(app.id==='optimization'?legacyOptimization:app.route));
  if(previous){
   const links=[...previous.querySelectorAll('a')];
   for(const extra of app.id==='optimization'?links:links.slice(1))card.append(extra.cloneNode(true));
  }
  card.append(code);fragment.append(card);
 }
 // The existing overview route remains useful alongside its registered demos.
 const overview=fallback.find(card=>card.querySelector('a').getAttribute('href')==='/tools/webgpu/');
 if(overview){overview.dataset.directoryShortcut='true';overview.dataset.category=groups[2];fragment.append(overview);}
 host.replaceChildren(fragment);experienceCount=EXPERIENCES.length;
}catch{
 catalogError=true;
 const categories=[0,0,1,1,1,0,3,0,3,1,1,1,2,1,2,2,2,2,3,3,3,3,0,2];
 fallback.forEach((card,index)=>{card.dataset.category=groups[categories[index]]||groups[2];});
}finally{clearTimeout(catalogTimer);}

const cards=[...host.querySelectorAll('article')];
let saved=new Set();
try{
 const values=JSON.parse(localStorage.getItem(favoriteKey)||'[]');
 if(Array.isArray(values))saved=new Set(values.filter(value=>typeof value==='string'));
}catch{}
if(!catalogError&&saved.delete(legacyOptimization))saved.add(optimization);
let active='All';
for(const name of ['All',...groups,'Favorites']){
 const button=document.createElement('button');button.type='button';button.textContent=name;
 button.addEventListener('click',()=>{active=name;render();});filters.append(button);
}
for(const card of cards){
 const key=card.querySelector('a').getAttribute('href');card.dataset.key=key;
 card.dataset.search=(card.textContent+' '+key+' '+card.dataset.category).toLowerCase();
 const top=document.createElement('div'),tag=document.createElement('span'),star=document.createElement('button');
 top.className='card-top';tag.className='category';tag.textContent=card.dataset.directoryShortcut?'Directory shortcut':card.dataset.category;
 star.type='button';star.className='favorite';
 star.addEventListener('click',()=>{
  saved.has(key)?saved.delete(key):saved.add(key);
  try{localStorage.setItem(favoriteKey,JSON.stringify([...saved]));}catch{}
  render();
 });top.append(tag,star);card.prepend(top);
}
function render(){
 const terms=input.value.trim().toLowerCase().split(/\s+/);let count=0;
 for(const card of cards){
  const favorite=saved.has(card.dataset.key),star=card.querySelector('.favorite'),title=card.querySelector('h2').textContent;
  star.textContent=favorite?'★':'☆';star.setAttribute('aria-pressed',String(favorite));
  star.setAttribute('aria-label',`${favorite?'Remove':'Save'} ${title} ${favorite?'from':'to'} favorites`);
  card.hidden=!(terms.every(term=>card.dataset.search.includes(term))&&(active==='All'||active==='Favorites'&&favorite||active===card.dataset.category));
  if(!card.hidden)count++;
 }
 for(const button of filters.children)button.setAttribute('aria-pressed',String(button.textContent===active));
 document.querySelector('#results-heading').textContent=active==='All'?'All workspaces':active;
 document.querySelector('#result-count').textContent=`${count} of ${cards.length} entries · ${catalogError?'basic directory; full catalog unavailable':`${experienceCount} registered experiences`}`;
 document.querySelector('.empty').hidden=count>0;
 document.querySelector('.empty p').textContent=active==='Favorites'&&!saved.size?'Save a workspace with its star button, then find it here.':'Try a different search or explore the full directory.';
 document.querySelector('.clear-search').hidden=!input.value;
}
input.addEventListener('input',render);
document.querySelector('.clear-search').addEventListener('click',()=>{input.value='';render();input.focus();});
document.querySelector('#reset').addEventListener('click',()=>{active='All';input.value='';render();input.focus();});
document.querySelector('.directory-tools').hidden=false;render();
