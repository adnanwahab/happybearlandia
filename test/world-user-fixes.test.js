import {describe,test,expect} from 'bun:test';
import {createHoustonBarCatalogHandler,normalizeHoustonBarElements} from '../world/bar/houston-catalog.js';
import {ringContains,findVenueFootprint,venueSceneGeometry} from '../world/bars/scene.js';
import {interpretRealityResults} from '../world/reality/results-interpretation.js';
import {EXPERIENCES} from '../world/universe/registry.js';
import {readFileSync} from 'node:fs';
import {createUIDocument} from './helpers/ui-dom.js';

describe('Houston Bar Atlas real OSM boundaries',()=>{
  const bar={type:'node',id:42,lat:29.72,lon:-95.38,tags:{amenity:'bar',name:'Example Record'}};
  test('normalizes safe OSM venues and preserves exact IDs',()=>{
    expect(normalizeHoustonBarElements([bar,bar,{...bar,id:43,tags:{amenity:'restaurant'}},{...bar,id:44,lat:35}])).toEqual([{
      id:'node:42',osmType:'node',osmId:42,kind:'bar',name:'Example Record',lat:29.72,lng:-95.38,
      address:'',neighborhood:'',levels:null,sourceUrl:'https://www.openstreetmap.org/node/42',
    }]);
  });
  test('caches bounded Overpass results, rejects POST, and never invents bars',async()=>{
    let calls=0;const handler=createHoustonBarCatalogHandler({lookup:async()=>{calls++;return{elements:[bar]};},now:()=>1000});
    const request=new Request('http://localhost/api/houston-bars');
    const first=await handler(request),body=await first.json();
    expect(first.status).toBe(200);expect(body.venueCount).toBe(1);expect(body.venues[0].id).toBe('node:42');
    await handler(request);expect(calls).toBe(1);
    expect((await handler(new Request(request.url,{method:'POST'}))).status).toBe(405);
    const missing=createHoustonBarCatalogHandler({lookup:async()=>{throw Error('unavailable');}});
    const unavailable=await missing(request);expect(unavailable.status).toBe(503);expect((await unavailable.json()).venues).toEqual([]);
  });
  test('uses exact way ID or point containment, never nearest guess',()=>{
    const venue={lat:29.72,lng:-95.38,osmType:'way',osmId:7};
    const b={id:'w7',pts:[[29.719,-95.381],[29.719,-95.379],[29.721,-95.379],[29.721,-95.381],[29.719,-95.381]],levels:2};
    expect(ringContains([venue.lat,venue.lng],b.pts)).toBe(true);
    const exact=findVenueFootprint(venue,{buildings:[b]});
    expect(exact.source).toBe('osm-exact-way');
    expect(venueSceneGeometry(venue,exact).levels).toBe(2);
    expect(findVenueFootprint({...venue,osmType:'node',osmId:99},{buildings:[{...b,pts:b.pts.map(([lat,lng])=>[lat+.1,lng])}]})).toBe(null);
    expect(venueSceneGeometry(venue,null).source).toBe('illustrative');
  });
});
test('Reality Compiler distinguishes policy-test nonpasses from actual simulation errors',()=>{
  const report={summary:{requested:100,completed:100,passed:0,failed:100,errors:0,unavailable:0},manifest:{tests:[{id:'rent',metric:'medianRent',operator:'<=',threshold:5,unit:'percent'}]},runs:[
    {status:'completed',pass:false,tests:[{id:'rent',status:'fail'}]},
  ]};
  const interpreted=interpretRealityResults(report);
  expect(interpreted.status).toBe('no-goals-met');
  expect(interpreted.title).toContain('0 met every goal');
  expect(interpreted.message).toContain('does not mean');
  expect(interpreted.details[0]).toContain('medianRent');
  expect(interpretRealityResults({summary:{requested:10,completed:0,errors:10},runs:[]}).status).toBe('no-completed-runs');
});
test('Home gallery, connected universe, and /routes share one catalog',async()=>{
 const index=readFileSync('index.html','utf8'),routes=readFileSync('routes.html','utf8'),shell=readFileSync('world/universe/shell.js','utf8');
 const document=createUIDocument();
 for(const id of ['carousel-rail','carousel-jump','carousel-category','carousel-status','preview-catalog','experience-count','carousel-prev','carousel-next']){const node=document.createElement('div');node.id=id;document.body.append(node);}
 const count=document.createElement('span');count.id='gallery-count';document.getElementById('experience-count').append(count);
 const catalog=document.getElementById('preview-catalog');catalog.content=document.createDocumentFragment();
 for(const match of index.matchAll(/<section data-carousel="([^"]+)"[^>]*>([\s\S]*?)<\/section>/g)){
  const section=document.createElement('section'),header=document.createElement('header'),title=document.createElement('h2'),frame=document.createElement('iframe');section.dataset.carousel=match[1];title.textContent=match[2].match(/<h2[^>]*>(.*?)<\/h2>/)[1].replaceAll('&amp;','&');header.append(title);section.append(header,frame);
  for(const attribute of match[2].match(/<iframe\b([^>]*)>/)[1].matchAll(/([\w-]+)="([^"]*)"/g))frame.setAttribute(attribute[1],attribute[2].replaceAll('&amp;','&'));
  catalog.content.append(section);
 }
 // The templates are optional: registry-only entries must also become cards.
 const source=readFileSync('tools/iframe-gallery.js','utf8').replace("const {EXPERIENCES}=await import('/world/universe/registry.js');",'');
 const Observer=class{observe(){}};
 const Option=function(label,value){const node=document.createElement('option');node.textContent=label;node.value=value;return node;};
 await new Function('document','EXPERIENCES','ResizeObserver','IntersectionObserver','Option','requestAnimationFrame',`return ${source}`)(document,EXPERIENCES,Observer,Observer,Option,callback=>callback());
 const cards=document.getElementById('carousel-rail').children;
 expect(cards).toHaveLength(EXPERIENCES.length);
 expect(cards.map(card=>card.querySelector('header a').href)).toEqual(EXPERIENCES.map(app=>app.route));
 expect(count.textContent).toBe(String(EXPERIENCES.length));
 expect(cards.filter(card=>card.querySelector('header a').href==='/world/bar')).toHaveLength(1);
 expect(cards.filter(card=>card.querySelector('header a').href==='/world/bars/')).toHaveLength(1);
 expect(EXPERIENCES.map(x=>x.id).length).toBe(new Set(EXPERIENCES.map(x=>x.id)).size);
 expect(routes).toContain("import {EXPERIENCES}");
 expect(shell).toContain('EXPERIENCES.length');
 expect(EXPERIENCES.find(x=>x.id==='houston-bars')?.route).toBe('/world/bars/');
});

function directorySession(initialFavorites='[]'){
 const document=createUIDocument();
 for(const [tag,key]of [['main','.routes'],['input','#search'],['div','.filters'],['h2','#results-heading'],['span','#result-count'],['section','.empty'],['button','.clear-search'],['button','#reset'],['section','.directory-tools']]){const node=document.createElement(tag);if(key[0]==='#')node.id=key.slice(1);else node.className=key.slice(1);document.body.append(node);}
 document.querySelector('.empty').append(document.createElement('p'));
 let saved=initialFavorites;const localStorage={getItem:()=>saved,setItem:(_,value)=>{saved=value;}};
 const html=readFileSync('routes.html','utf8'),script=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/import .*?;\n/,'');
 new Function('document','localStorage','EXPERIENCES',script)(document,localStorage,EXPERIENCES);
 return{document,saved:()=>JSON.parse(saved)};
}

test('directory keeps every registry card, search, categories and saved favorites',async()=>{
 const {document,saved}=directorySession(),cards=document.querySelector('.routes').children,input=document.querySelector('#search');
 expect(cards.map(card=>card.dataset.experienceId)).toEqual(EXPERIENCES.map(app=>app.id));
 expect(cards.map(card=>card.querySelector('a').href)).toEqual(EXPERIENCES.map(app=>app.route));
 expect(document.querySelector('#result-count').textContent).toBe(`${EXPERIENCES.length} of ${EXPERIENCES.length} workspaces`);
 input.value='houston';await input.dispatch('input');expect(cards.filter(card=>!card.hidden).map(card=>card.dataset.experienceId)).toEqual(['houston-map','houston-bars']);
 await document.querySelector('.clear-search').click();expect(cards.every(card=>!card.hidden)).toBe(true);
 const social=cards.find(card=>card.dataset.experienceId==='social-bear');await social.querySelector('.favorite').click();expect(saved()).toEqual(['/world/bar']);
 await document.querySelector('.filters').children.find(button=>button.textContent==='Favorites').click();expect(cards.filter(card=>!card.hidden)).toEqual([social]);
 const restored=directorySession(JSON.stringify(saved())).document;await restored.querySelector('.filters').children.find(button=>button.textContent==='Favorites').click();expect(restored.querySelector('.routes').children.filter(card=>!card.hidden).map(card=>card.dataset.experienceId)).toEqual(['social-bear']);
 await document.querySelector('.filters').children.find(button=>button.textContent==='Tools & analysis').click();expect(cards.filter(card=>!card.hidden).map(card=>card.dataset.experienceId)).toEqual(EXPERIENCES.filter(app=>app.category==='science').map(app=>app.id));
});

test('directory retains labeled supplemental destinations outside filtered registry cards',()=>{
 const html=readFileSync('routes.html','utf8'),section=html.match(/<section class="directory-extras"[^>]*>[\s\S]*?<\/section>/)?.[0];
 expect(section).toBeDefined();expect(section).toContain('aria-labelledby="additional-destinations-heading"');expect(section).toContain('id="additional-destinations-heading"');
 const links=[...section.matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)];
 expect(links.map(match=>match[1])).toEqual(['/tools/webgpu/','/world/decision.html?demo=1#advanced','/world/experiment-lab.html','/world/research-library.html','https://dear-congress.fly.dev/']);
 expect(links.every(match=>match[2].trim().length>0)).toBe(true);
 expect(html.indexOf(section)).toBeGreaterThan(html.indexOf('</main>'));
});
