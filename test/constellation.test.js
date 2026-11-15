import {test,expect} from 'bun:test';
import {constellationLayout} from '../world/universe/constellation.js';
import {EXPERIENCES} from '../world/universe/registry.js';
test('layout preserves every source identity exactly once without mutating input',()=>{
 const groups=[...new Set(EXPERIENCES.map(e=>e.category))];
 const cards=EXPERIENCES.map(e=>({dataset:{category:e.category},hidden:false,id:e.id}));
 const before=JSON.stringify(cards);const layout=constellationLayout(cards,groups);
 expect(layout.families.flatMap(f=>f.members).map(c=>c.id).sort()).toEqual(cards.map(c=>c.id).sort());
 expect(JSON.stringify(cards)).toBe(before);
});
test('filter, empty and bounded zoom keep finite dimensions',()=>{
 const cards=[{dataset:{category:'a'},hidden:true},{dataset:{category:'a'},hidden:false}];
 expect(constellationLayout(cards,['a']).families[0].members).toEqual([cards[1]]);
 for(const zoom of [-100,.75,1,1.5,100]){const l=constellationLayout([],['a'],zoom);expect(l.scale).toBeGreaterThanOrEqual(.75);expect(l.scale).toBeLessThanOrEqual(1.5);expect(l.height).toBeGreaterThan(0);}
});
(process.env.HBL_CONSTELLATION_DOM ? test : test.skip)('DOM view toggles preserve nodes, exact hrefs, favorites and bounded zoom',async()=>{
 const {Window}=await import(process.env.HBL_CONSTELLATION_DOM);
 const {mountConstellation}=await import('../world/universe/constellation.js');
 const w=new Window();const d=w.document;
 d.body.innerHTML='<button id="constellation-view"></button><button id="list-view"></button><div class="zoom-tools"><button id="zoom-in"></button><button id="zoom-out"></button><button id="zoom-reset"></button><output id="zoom-level"></output></div><p id="map-help"></p><div class="map-window"></div><main class="routes"><article data-category="a"><a href="/world">World</a><button class="favorite">Save</button></article></main>';
 const host=d.querySelector('main'),card=host.firstElementChild,link=card.querySelector('a');
 const c=mountConstellation(host,['a']);expect(d.querySelector('.map-window main')).toBe(host);
 for(let i=0;i<10;i++)d.querySelector('#zoom-in').click();expect(d.querySelector('#zoom-level').textContent).toBe('150%');
 d.querySelector('#list-view').click();expect(d.querySelector('.map-window').hidden).toBe(true);expect(host.firstElementChild).toBe(card);expect(link.getAttribute('href')).toBe('/world');
 card.hidden=true;c.update();d.querySelector('#constellation-view').click();expect(d.querySelector('.family-title').hidden).toBe(true);expect(d.querySelectorAll('path').length).toBe(0);
 card.hidden=false;c.update();expect(d.querySelectorAll('path').length).toBe(1);
 expect(card.querySelector('.favorite').textContent).toBe('Save');
 w.close();
});
