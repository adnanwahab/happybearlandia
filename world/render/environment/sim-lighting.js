// Presentation assumptions: fixed 06:00–20:00 solar day, Monday at minute zero.
// These colors and office hours are authored, not weather or energy observations.
const clamp=x=>Math.max(0,Math.min(1,x));
const blend=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
export function simulationLighting(minute,overrideHour){
 const m=((minute%1440)+1440)%1440,h=overrideHour??m/60,day=((Math.floor(minute/1440)%7)+7)%7;
 const angle=(h-6)/14*Math.PI,daylight=h>=6&&h<=20?Math.max(0,Math.sin(angle)):0;
 const twilight=Math.max(0,1-Math.min(Math.abs(h-6),Math.abs(h-19.5))/1.5);
 let rgb=blend([.025,.035,.08],[.58,.75,.91],daylight);
 rgb=blend(rgb,[.88,.39,.24],twilight*.65);
 if(day>=5)rgb=blend(rgb,[.70,.72,.81],daylight*(day===6&&h<11?.16:.06));
 const skyColor=(Math.round(rgb[0]*255)<<16)|(Math.round(rgb[1]*255)<<8)|Math.round(rgb[2]*255);
 return {minute,hour:h,day,daylight,angle,twilight,skyColor,lamps:clamp((.25-daylight)/.25)};
}
export function legacyHomeCounts(people,buildings){
 const rows=new Map(buildings.map(b=>[String(b.id),{buildingId:String(b.id),residents:0,atHome:0}]));
 for(const p of people){const b=buildings[p.home],row=b&&rows.get(String(b.id));if(!row)continue;row.residents++;if(p.mode==='doing'&&p.target===p.home)row.atHome++;}
 return [...rows.values()];
}
export function windowFraction(building,home,present,hour,day){
 if(building.kind==='park')return 0;
 // Office closure is an authored presentation gate, including synthetic home anchors.
 if(['work','office'].includes(building.kind)&&!(day<5&&hour>=8&&hour<18))return 0;
 if(home?.residents>0)return clamp(home.atHome/home.residents);
 return present>0?1:0;
}

export function legacyBuildingOccupancy(people,buildings){
 const counts=new Map();for(const p of people){if(p.mode!=='doing'||p.target==null)continue;const id=buildings[p.target]?.id;if(id!=null)counts.set(String(id),(counts.get(String(id))??0)+1);}
 return [...counts].map(([buildingId,count])=>({buildingId,count}));
}
