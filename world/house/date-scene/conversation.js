const fields=['azimuth','elevation','distance','targetX','targetZ','targetY'];
export function conversationCamera(points,{mode='pair'}={}){
 const valid=points.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.z));if(!valid.length)return null;
 const targetX=valid.reduce((s,p)=>s+p.x,0)/valid.length,targetZ=valid.reduce((s,p)=>s+p.z,0)/valid.length;
 const spread=Math.max(...valid.map(p=>Math.hypot(p.x-targetX,p.z-targetZ)));
 return {azimuth:(valid[0].heading??0)+.16,elevation:.16,distance:Math.max(mode==='closeup'?3.1:4.8,spread*3.5+3),targetX,targetZ,targetY:1.25};
}
export function interpolateConversationCamera(from,to,progress){const t=Math.max(0,Math.min(1,progress)),ease=t*t*(3-2*t),result={};for(const key of fields){let difference=to[key]-from[key];if(key==='azimuth')difference=Math.atan2(Math.sin(difference),Math.cos(difference));result[key]=from[key]+difference*ease;}if(t===1)return {...to};return result;}
