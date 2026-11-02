export const JOURNAL_CITIES=Object.freeze([
 {id:'gulfton',name:'Gulfton, Houston',lat:29.7286,lng:-95.4746},
 {id:'downtown-houston',name:'Downtown Houston',lat:29.7520,lng:-95.3580},
 {id:'katy',name:'Katy, TX',lat:29.7858,lng:-95.8245},
 {id:'east-village',name:'East Village, NYC',lat:40.7265,lng:-73.9815},
 {id:'shibuya',name:'Shibuya, Tokyo',lat:35.6595,lng:139.7005},
 {id:'camden',name:'Camden, London',lat:51.5390,lng:-.1426},
 {id:'lagos-island',name:'Lagos Island',lat:6.4541,lng:3.3947},
]);
export function journalCity(origin){return JOURNAL_CITIES.find(c=>Math.abs(c.lat-origin?.lat)<.00005&&Math.abs(c.lng-origin?.lng)<.00005)??null;}
