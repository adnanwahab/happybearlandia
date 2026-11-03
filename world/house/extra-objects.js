/** Purchasable game objects, with declared inventory footprints. */
export const EXTRA_HOUSE_OBJECTS=Object.freeze({
coffeeTable:{label:'Coffee table',category:'Tables',cost:95,roomId:'living',capacity:1,width:2,depth:1.1},
rug:{label:'Woven rug',category:'Decor',cost:80,roomId:'living',capacity:1,width:4.7,depth:2.5},
armchair:{label:'Armchair',category:'Seating',cost:220,roomId:'living',capacity:1,width:1.5,depth:1.6,restRecovery:.12},
ottoman:{label:'Ottoman',category:'Seating',cost:90,roomId:'living',capacity:1,width:1.2,depth:1,restRecovery:.12},
sideTable:{label:'Side table',category:'Tables',cost:65,roomId:'living',capacity:1,width:0.9,depth:0.9},
nightstand:{label:'Nightstand',category:'Bedroom',cost:75,roomId:'bedroom',capacity:1,width:0.8,depth:0.8},
dresser:{label:'Dresser',category:'Storage',cost:180,roomId:'bedroom',capacity:1,width:1.8,depth:0.8},
wardrobe:{label:'Wardrobe',category:'Storage',cost:320,roomId:'bedroom',capacity:1,width:1.8,depth:0.9},
displayCabinet:{label:'Display cabinet',category:'Storage',cost:240,roomId:'living',capacity:1,width:1.5,depth:0.7},
consoleTable:{label:'Console table',category:'Tables',cost:150,roomId:'living',capacity:1,width:2.2,depth:0.6},
accentLamp:{label:'Accent lamp',category:'Lighting',cost:45,roomId:'living',capacity:1,width:0.5,depth:0.5},
standingClock:{label:'Standing clock',category:'Decor',cost:110,roomId:'living',capacity:1,width:0.7,depth:0.6},
standingMirror:{label:'Standing mirror',category:'Decor',cost:100,roomId:'bedroom',capacity:1,width:1,depth:0.65},
artEasel:{label:'Art easel',category:'Work & hobbies',cost:85,roomId:'study',capacity:1,width:1.1,depth:1},
shoeRack:{label:'Shoe rack',category:'Storage',cost:55,roomId:'living',capacity:1,width:1.3,depth:0.6},
coatRack:{label:'Coat rack',category:'Storage',cost:60,roomId:'living',capacity:1,width:0.8,depth:0.8},
gardenBench:{label:'Garden bench',category:'Garden furniture',cost:130,roomId:'garden',capacity:3,width:2.4,depth:0.9,restRecovery:.12},
birdbath:{label:'Birdbath',category:'Garden furniture',cost:90,roomId:'garden',capacity:1,width:1,depth:1},
wateringCan:{label:'Watering can',category:'Garden tools',cost:20,roomId:'garden',capacity:1,width:0.65,depth:0.5},
flowerArch:{label:'Flower arch',category:'Garden',cost:140,roomId:'garden',capacity:1,width:2,depth:0.9,garden:true},
raisedBed:{label:'Raised garden bed',category:'Garden',cost:100,roomId:'garden',capacity:1,width:2,depth:1.2,garden:true}
});
export const EXTRA_OBJECT_FOOTPRINTS=Object.freeze(Object.fromEntries(Object.entries(EXTRA_HOUSE_OBJECTS).map(([id,o])=>[id,{width:o.width,depth:o.depth}])));
export const EXTRA_OBJECT_PLACEMENTS=Object.freeze(Object.fromEntries(Object.keys(EXTRA_HOUSE_OBJECTS).map(id=>[id,{x:0,z:0,rotation:0}])));
