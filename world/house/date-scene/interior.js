/** Fictional date furnishings only: no claim about an actual venue's layout. */
export const DATE_INTERIOR_SPOTS=Object.freeze([
 {id:'quiet-booth',label:'Quiet booth',x:-5,z:-3,actions:['talk','share-food','personal-question']},
 {id:'music-corner',label:'Music corner',x:5,z:-3,actions:['choose-song','dance','duet']},
 {id:'photo-spot',label:'Photo spot',x:5,z:3,actions:['choose-pose','take-photo']}
].map(s=>Object.freeze({...s,actions:Object.freeze(s.actions)})));
export function createInteriorCoordinates(people,area){const spot=DATE_INTERIOR_SPOTS.find(s=>s.id===area),cx=spot?spot.x*.55:0,cz=spot?spot.z*.55:1;const offsets=new Map(people.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.z)).map((p,i)=>[String(p.id),{x:cx+(i%2? .65:-.65)-p.x,z:cz-p.z}]));return {toVisual(p){const o=offsets.get(String(p.id));return o?{x:Math.max(-8,Math.min(8,p.x+o.x)),z:Math.max(-5.5,Math.min(5.5,p.z+o.z))}:{x:0,z:1};},toCanonical(id,p){const o=offsets.get(String(id));if(!o||!Number.isFinite(p.x)||!Number.isFinite(p.z))return null;return{x:Math.max(-8,Math.min(8,p.x))-o.x,z:Math.max(-5.5,Math.min(5.5,p.z))-o.z};},has:id=>offsets.has(String(id))};}
export function createDateInterior(THREE,scene,{document}={}){
 const group=new THREE.Group();group.name='Fictional playable bar interior';scene.add(group);const materials=[],geometries=[],textures=[];
 const mat=(color,extra={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.75,...extra});materials.push(m);return m;};const wood=mat('#7b442c'),dark=mat('#30202a'),velvet=mat('#963f4e'),brass=mat('#d5a65a',{metalness:.5,roughness:.3}),cream=mat('#ffe4a9');
 function box(name,x,y,z,w,h,d,m){const geo=new THREE.BoxGeometry(w,h,d);geometries.push(geo);const mesh=new THREE.Mesh(geo,m);mesh.name=name;mesh.position.set(x,y,z);group.add(mesh);return mesh;}
 const floor=box('Interior walkable floor',0,-.12,0,18,.24,14,wood);floor.userData.ground=true;
 box('Warm back wall',0,2,-7,18,4,.25,dark);box('Left wall',-9,1.1,0,.2,2.2,14,dark);
 for(let x=-8;x<=8;x+=1)box('Floor plank seam',x,.006,0,.025,.01,14,dark);
 box('Bar counter',0,1,-5.3,5.5,2,1,wood);box('Brass counter top',0,2.05,-5.3,5.9,.12,1.3,brass);
 for(let x=-2;x<=2;x+=1.3){box('Stool leg',x,.5,-3.9,.12,1,.12,brass);box('Stool cushion',x,1.05,-3.9,.65,.16,.65,velvet);box('Glass on bar',x,2.3,-5.3,.16,.36,.16,cream);}
 box('Quiet booth seat',-5,.5,-4.2,3,.55,1.3,velvet);box('Quiet booth back',-5,1.25,-4.8,3,1.4,.25,velvet);box('Booth table',-5,.85,-2.8,2,.12,1.2,wood);box('Table pedestal',-5,.4,-2.8,.2,.8,.2,brass);
 box('Music stage',5,.12,-4,4,.24,3,dark);box('Music console',5,1,-5,1.4,1.8,.5,wood);for(const x of [3.6,6.4]){box('Speaker',x,.8,-5,.6,1.5,.6,dark);box('Speaker grille',x,.9,-4.68,.4,.8,.03,brass);}box('Microphone stand',5,.85,-3.7,.06,1.7,.06,brass);box('Microphone',5,1.75,-3.7,.3,.12,.12,dark);
 box('Photo backdrop',6,1.65,4.5,4,3.3,.16,velvet);box('Photo frame top',6,3.4,4.3,4.3,.15,.2,brass);for(const x of [3.9,8.1])box('Photo frame side',x,1.8,4.3,.15,3.3,.2,brass);
 box('Entrance mat',-2,.015,5.5,3,.03,1.4,dark);
 for(const s of DATE_INTERIOR_SPOTS){const m=box(s.label+' interaction marker',s.x,.025,s.z,1.5,.05,1,mat('#e2bb6c'));m.userData.interiorSpot=s;}
 const ambient=new THREE.HemisphereLight('#ffdcaa','#38202a',2.2);group.add(ambient);for(const [x,z]of [[-5,-3],[5,-3],[5,3],[0,1]]){const light=new THREE.PointLight('#ffd49b',25,13,1.6);light.position.set(x,3,z);group.add(light);box('Warm pendant',x,3.2,z,.5,.18,.5,mat('#fff0b8',{emissive:'#ffb644',emissiveIntensity:1.3}));}
 if(document){const canvas=document.createElement('canvas');canvas.width=768;canvas.height=128;const ctx=canvas.getContext('2d');ctx.fillStyle='#30202a';ctx.fillRect(0,0,768,128);ctx.fillStyle='#ffdf9a';ctx.font='bold 37px sans-serif';ctx.textAlign='center';ctx.fillText('THE LITTLE EVENING',384,52);ctx.font='23px sans-serif';ctx.fillText('Fictional game interior · not the real venue layout',384,94);const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;textures.push(tex);const sign=box('Fictional interior sign',0,3,-6.8,7,1.16,.05,mat('#ffffff',{map:tex,emissive:'#ffffff',emissiveMap:tex,emissiveIntensity:.4}));}
 group.visible=false;
 return{group,spots:DATE_INTERIOR_SPOTS,destroy(){scene.remove(group);for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();},getDebug:()=>({fictional:true,canonicalPopulationAdded:0,spotIds:DATE_INTERIOR_SPOTS.map(s=>s.id),props:group.children.length})};
}
