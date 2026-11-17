import {visualSeed} from './mesh-data.js';
// Authored cosmetic choices, never observations of business performance or wealth.
const palettes={
 home:{colors:[0xbca58b,0xc7b69e,0xaa9989],roofs:['gable','hip','parapet'],spacing:3.2},
 work:{colors:[0x697b80,0x85877d,0x99988a],roofs:['mechanical','parapet'],spacing:2.4},
 shop:{colors:[0xc1ad91,0xb29a86,0xa8afa1],roofs:['flat','parapet'],spacing:3.4},
 food:{colors:[0xc3a18a,0xb5ad91,0xb29e9b],roofs:['flat','parapet'],spacing:3},
 school:{colors:[0xbca287,0xadaf9a,0xb6aa99],roofs:['hip','parapet'],spacing:3.6},
};
export function architecturePalette(building={}) {
 const kit=palettes[building.kind];
 if(!kit)return null; // Unknown categories and parks retain the existing shell.
 const seed=visualSeed(building.id??'building',building.worldRevision??0);
 const variant=seed%3;
 return {label:'Cosmetic architecture',variant,color:kit.colors[variant],roofColor:[0x303a3c,0x41423c,0x49403c][variant],roofType:kit.roofs[seed%kit.roofs.length],storefront:['shop','food'].includes(building.kind),columnSpacing:kit.spacing+variant*.2,windowWidth:[.48,.6,.7][variant],windowHeight:[.58,.64,.68][variant],awningWidth:4+variant,awningDepth:.7+variant*.2};
}
