/** Illustrative local events. Effects are temporary multipliers, not damage,
 * predictions, or permission to overwrite economic/population ownership. */
const event=(type,title,category,durationMinutes,scene,effects,description)=>({type,title,category,durationMinutes,scene,effects,description});
export const CULTURE_EVENT_TYPES=Object.freeze([
 event('farmers-market','Farmers market','festival',240,'food',{demand:1.12,roads:.94},'Local growers and cooks gather; nearby shopping demand rises.'),
 event('concert','Neighborhood concert','festival',180,'music',{demand:1.18,roads:.85,transit:.95},'A local music scene draws evening visitors.'),
 event('parade','Neighborhood parade','festival',150,'traditions',{demand:1.1,roads:.65},'A procession uses local streets temporarily.'),
 event('marathon','City marathon','festival',300,'sports',{demand:1.12,roads:.6},'Runners and spectators share a temporarily restricted route.'),
 event('fireworks','Community fireworks','festival',90,'traditions',{demand:1.08,roads:.85},'An evening display draws a local crowd.'),
 event('block-party','Block party','festival',240,'nightlife',{demand:1.1,roads:.8},'Neighbors host a street gathering.'),
 event('protest','Public demonstration','festival',180,'slang',{roads:.8},'Residents assemble in public. The model does not infer their politics or treat protest as harm.'),
 event('convention','Local convention','festival',480,'fashion',{demand:1.2,roads:.9},'A gathering brings visitors to local venues.'),
 event('sports-championship','Sports championship','festival',240,'sports',{demand:1.18,roads:.8,transit:.92},'A championship brings supporters and extra travel demand.'),
 event('food-festival','Neighborhood food festival','festival',300,'food',{demand:1.22,roads:.85},'Cooks and vendors exchange recipes and draw visitors.'),
 event('local-tradition','Annual slightly peculiar tradition','festival',180,'traditions',{demand:1.08,roads:.92},'Residents celebrate the ceremonial neighborhood spoon procession.'),
 event('power-outage','Power outage','incident',180,'nightlife',{services:.65,demand:.85},'Local services and commerce are temporarily constrained; utility-network repair is not modeled.'),
 event('heat-wave','Heat wave','incident',720,'architecture',{services:.85,demand:.92},'Heat temporarily limits service access. Thermal health and building temperatures are not modeled.'),
 event('traffic-jam','Unexpected traffic jam','incident',120,'sports',{roads:.6},'Road access is constrained until the jam clears.'),
 event('water-main-break','Water-main break','incident',360,'architecture',{services:.7,roads:.8},'A local break limits access. Pipe hydraulics and repair budgets are not modeled.'),
 event('transit-strike','Transit strike','incident',480,'slang',{transit:.25},'Transit availability temporarily falls; labor negotiations are outside this model.'),
 event('viral-restaurant','Restaurant goes viral','incident',720,'food',{demand:1.35,roads:.92},'A sudden queue increases local demand and crowds the street.'),
 event('celebrity-visit','Unexpected celebrity visit','incident',180,'fashion',{demand:1.18,roads:.85},'Visitors gather around a local venue.'),
 event('huge-concert','Surprise huge concert','incident',300,'music',{demand:1.35,roads:.65,transit:.85},'An unusually large audience strains local access.'),
 event('alien-rumor','Alien sighting rumor','incident',180,'slang',{demand:1.06},'An unverified rumor spreads. No aliens or objective supernatural effects are simulated.'),
 event('escaped-zoo-animal','Escaped zoo animal','incident',120,'traditions',{roads:.8},'A precautionary street restriction lasts until the animal is safely returned.'),
 event('meteor-shower','Meteor shower','incident',180,'nightlife',{demand:1.08},'Residents gather for stargazing.'),
 event('inflatable-bear','Giant inflatable bear blocks traffic','absurd',90,'traditions',{roads:.7},'A wayward inflatable bear temporarily obstructs a street; there is no permanent damage.'),
 event('monolith','Mysterious monolith appears','absurd',720,'architecture',{demand:1.08},'An unexplained public-art object attracts curious visitors.'),
 event('cowboy-hats','Sudden cowboy-hat craze','absurd',1440,'fashion',{demand:1.04},'Hundreds of residents adopt an unlikely local fashion trend.')
].map(row=>Object.freeze({...row,effects:Object.freeze(row.effects)})));
export const CULTURE_SCENES=Object.freeze([
 {id:'music',label:'Music',institutions:['music','theatre','theater','concert','arts'],styles:['garage folk','rooftop jazz','community choirs','late-night synth']},
 {id:'fashion',label:'Fashion',institutions:['clothes','clothing','fashion','tailor','market'],styles:['repaired denim','bright sneakers','handmade layers','patterned shirts']},
 {id:'slang',label:'Slang',institutions:['school','college','library','community'],styles:['bear with me','meet at the corner','good neighbor energy','take the scenic route']},
 {id:'food',label:'Food',institutions:['food','cafe','restaurant','grocery','bakery','diner','market'],styles:['seasonal street food','shared-table suppers','experimental pastries','garden-to-table cooking']},
 {id:'sports',label:'Sports',institutions:['park','stadium','sports','pitch','gym','school'],styles:['pickup football','neighborhood running','street basketball','casual cycling']},
 {id:'architecture',label:'Architecture',institutions:['library','museum','arts','community','home'],styles:['shaded courtyards','colorful storefronts','reused brick','shared front porches']},
 {id:'nightlife',label:'Nightlife',institutions:['bar','pub','club','music','restaurant'],styles:['listening bars','late cafes','open-air dancing','quiet evening walks']},
 {id:'traditions',label:'Local traditions',institutions:['community','park','museum','library','faith','church','temple'],styles:['spoon procession','sunrise picnic','porch-light evening','neighborhood story walk']}
].map(row=>Object.freeze({...row,institutions:Object.freeze(row.institutions),styles:Object.freeze(row.styles)})));
