export const BENCHMARK_SCENES=Object.freeze(['aerial-city','downtown','construction','rush-hour','night','rain']);
export function benchmarkScene(pathname) {
 const match=pathname.match(/^\/world\/bench\/([^/]+)\/?$/);
 return match&&BENCHMARK_SCENES.includes(match[1])?match[1]:null;
}
export function configureBenchmark(api,name) {
 if(!BENCHMARK_SCENES.includes(name))throw new RangeError('Unknown benchmark scene');
 api.setTimeOfDay(name==='night'?22:name==='rain'?16:14);
 api.setWeather(name==='rain'?'rain':'clear');
 api.updateCity({trafficDensity:name==='rush-hour'?1:.6});
 api.focusDistrict({x:0,z:0,radius:name==='downtown'?65:450});
 if(name==='construction')api.updateCity({constructionProjects:Array.from({length:10},(_,i)=>({id:`benchmark-${i}`,x:(i%5)*65-130,z:Math.floor(i/5)*90-45,width:24,depth:24,height:70,progress:.15+i*.08,phase:['excavation','foundation','frame','floors','facade'][i%5]}))});
}
// Same camera path, independent of frame rate and simulation clock.
export function scriptedCamera(camera,controls,seconds) {
 const keys=[{t:0,p:[700,700,700],target:[0,0,0]},{t:6,p:[180,170,220],target:[0,20,0]},{t:12,p:[-100,100,120],target:[0,30,0]},{t:18,p:[20,10,100],target:[0,8,0]},{t:24,p:[150,110,130],target:[0,30,0]},{t:30,p:[450,400,450],target:[0,0,0]}];
 const end=Math.min(30,Math.max(0,seconds)),i=Math.min(keys.length-2,Math.floor(end/6)),a=keys[i],b=keys[i+1];let f=(end-a.t)/(b.t-a.t);f=f*f*(3-2*f);
 camera.position.set(...a.p.map((v,j)=>v+(b.p[j]-v)*f));controls.target.set(...a.target.map((v,j)=>v+(b.target[j]-v)*f));
}
