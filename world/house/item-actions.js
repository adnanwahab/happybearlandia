/** Declared game activities: elapsed time and existing needs, no invented health,
 * wages, biographies, causal wellbeing scores or unrecorded resource balances. */
const all=['*'],seats=['bed','couch','armchair','ottoman','gardenBench'],storage=['desk','books','dresser','wardrobe','displayCabinet','shoeRack','coatRack','coffeeTable','sideTable','nightstand','consoleTable','diningTable','stove'],plants=['plant','flowers','herbs','tree','roseBush','raisedBed','flowerArch'];
const action=(label,types,minutes,pose,needRates,extra={})=>({label,objectTypes:types,durationMinutes:minutes,minAge:6,roomId:'living',pose,needRates,requires:['selected installed object','available home resident'],mechanism:'Player-directed '+label.toLowerCase()+' uses actual elapsed minutes, existing need meters and a retained object-use record.',...extra});
export const ITEM_ACTIONS=Object.freeze({
 cleanObject:action('Clean this item',all,15,'clean',{energy:-.05}),
 maintainObject:action('Care for this item',all,15,'clean',{energy:-.045}),
 organizeObject:action('Tidy & organize',storage,20,'clean',{energy:-.045,fun:.015}),
 relaxObject:action('Relax here',seats,30,'rest',{energy:.065,fun:.02},{minAge:0}),
 nap:action('Take a short nap',seats,30,'rest',{energy:.12,fun:-.025},{minAge:0}),
 readAtSeat:action('Read here',seats,30,'read',{energy:-.025,fun:.075}),
 stretch:action('Stretch', ['rug'],20,'clean',{energy:-.045,fun:.065}),
 meditate:action('Sit quietly',['rug','gardenBench'],20,'rest',{energy:.025,fun:.04}),
 practiceArt:action('Paint a picture',['artEasel'],45,'clean',{energy:-.04,fun:.10}),
 admireObject:action('Take a closer look',['artEasel','displayCabinet','standingClock','flowers','roseBush','tree','flowerArch'],15,'idle',{energy:-.025,fun:.045}),
 freshenUp:action('Freshen up',['standingMirror'],15,'clean',{energy:-.025,fun:.05}),
 brightenLight:action('Brighten the room',['lamp','accentLamp'],15,'clean',{energy:-.035}),
 dimLight:action('Dim the room',['lamp','accentLamp'],15,'clean',{energy:-.035}),
 waterPlants:action('Water plants',[...plants,'wateringCan'],20,'garden',{energy:-.055,fun:.075}),
 arrangeFlowers:action('Arrange the flowers',['flowers','roseBush','flowerArch'],25,'garden',{energy:-.045,fun:.085}),
 tendBirdbath:action('Tend the birdbath',['birdbath'],20,'garden',{energy:-.045,fun:.04}),
});
export const actionsForObject=type=>Object.entries(ITEM_ACTIONS).filter(([,a])=>a.objectTypes.includes('*')||a.objectTypes.includes(type)).map(([id])=>id);
