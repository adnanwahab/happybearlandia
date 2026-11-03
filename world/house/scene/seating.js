export const COUCH_GEOMETRY=Object.freeze({baseY:.3,baseHeight:.36,backY:.78,backHeight:.9,cushionY:.54,cushionHeight:.16,seatTop:.54+.16/2,seatZOffset:.2,slotSpacing:1.1});
/** Presentation-only seat geometry; never grants a model activity or seat. */
export function seatedBodyLayout({seatTop=.9,floor=.2,scale=1,slot=0,capacity=3,centerX=0,centerZ=0,spacing=1.1,z=0,frontEdgeZ}={}){
 if(![seatTop,floor,scale,centerX,centerZ,spacing].every(Number.isFinite)||scale<=0||seatTop<=floor||!Number.isInteger(slot)||!Number.isInteger(capacity)||slot<0||capacity<1||slot>=capacity)throw new Error('A valid available rendered seat is required');
 const bodyZ=Number.isFinite(frontEdgeZ)?Math.max(0,frontEdgeZ-z-.32*scale+.1*scale+.02):0;
 const bodyY=seatTop+.12-.72*scale,hipY=bodyY+.68*scale,shinLength=(hipY-floor-.08*scale)/scale;
 return{x:centerX+(slot-(capacity-1)/2)*spacing,z:centerZ+bodyZ,bodyY,bodyZ,hipY,thighAngle:-Math.PI/2,shinAngle:Math.PI/2,shinLength:Math.max(.2,Math.min(.45,shinLength)),footY:hipY-Math.max(.2,Math.min(.45,shinLength))*scale-.015*scale,pelvisBottom:bodyY+(.72-.11)*scale,torsoBackZ:centerZ+bodyZ-.145*scale};
}
