export const ARCHETYPES=Object.freeze({
 'single-family':{floorHeight:3,roofType:'gable',facadeStyle:'brick',podium:false},
 townhouse:{floorHeight:3,roofType:'parapet',facadeStyle:'brick',podium:false},
 'walk-up':{floorHeight:3.1,roofType:'parapet',facadeStyle:'brick',podium:false},
 'mid-rise':{floorHeight:3.2,roofType:'mechanical',facadeStyle:'concrete',podium:false},
 'podium-tower':{floorHeight:3.2,roofType:'mechanical',facadeStyle:'glass-residential',podium:true},
 office:{floorHeight:3.8,roofType:'mechanical',facadeStyle:'glass-office',podium:true},
 hotel:{floorHeight:3.2,roofType:'parapet',facadeStyle:'concrete',podium:true},
 warehouse:{floorHeight:5,roofType:'sawtooth',facadeStyle:'metal',podium:false},
 industrial:{floorHeight:5,roofType:'sloped',facadeStyle:'metal',podium:false},
 shopping:{floorHeight:4.2,roofType:'flat',facadeStyle:'storefront',podium:false},
 school:{floorHeight:3.6,roofType:'hip',facadeStyle:'brick',podium:false},
 hospital:{floorHeight:3.6,roofType:'mechanical',facadeStyle:'concrete',podium:true},
});
export function facadeLayout(style='concrete') {
 const glass=style.startsWith('glass');return {floorHeight:glass?3.4:3.2,columnSpacing:glass?2.4:3.2,windowWidth:glass?.76:.58,windowHeight:.62,frameWidth:glass?.04:.12};
}
