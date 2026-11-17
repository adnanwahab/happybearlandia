import {atlasGeometry,visualSun} from './model.js';
import {simulationLighting} from '../environment/sim-lighting.js';
export function mountShadowAtlas(parent,town,onHour){
 const doc=parent.ownerDocument,root=doc.createElement('details');root.dataset.testid='shadow-atlas';
 const summary=doc.createElement('summary');summary.textContent='Tree-Shadow Atlas';root.append(summary);
 const note=doc.createElement('p');note.textContent='Geometry-only approximation · loaded footprints and scene heights (which may be synthetic). Flat ground, vertical extrusions, opaque walls; no terrain, canopy, health or thermal comfort model. Tree map unavailable: no tree shadows. Decorative park trees are excluded. Up to 500 loaded footprints; no streamed coverage guarantee.';root.append(note);
 const source=doc.createElement('p');source.textContent=`Geometry source: ${town.source??'unavailable'} · ${town.attribution??'no attribution supplied'}. Heights are scene inputs, not verified measurements.`;root.append(source);
 const label=doc.createElement('label');label.textContent='Drag sunlight (visual hour) ';
 const input=doc.createElement('input');input.type='range';input.min='7';input.max='19';input.step='.25';input.value='14';input.setAttribute('aria-label','Atlas sunlight hour');input.style.cssText='min-height:44px;width:100%';label.append(input);root.append(label);
 const status=doc.createElement('output');root.append(status);
 const ns='http://www.w3.org/2000/svg',svg=doc.createElementNS(ns,'svg');svg.setAttribute('aria-label','Approximate building shadows and park footprints');svg.setAttribute('role','img');svg.style.cssText='display:block;width:100%;height:260px;background:#d9e5ce';root.append(svg);parent.append(root);
 let key='',destroyed=false;
 function update(lighting){if(destroyed||!root.open)return;const angle=lighting?.angle??simulationLighting(0,Number(input.value)).angle;if(key===String(angle))return;key=String(angle);const rows=atlasGeometry(town.buildings,visualSun(angle));svg.replaceChildren();const points=rows.flatMap(r=>r.poly);if(!points.length){status.textContent='Geometry unavailable';return;}
 const xs=points.map(p=>p[0]),zs=points.map(p=>p[1]),x=Math.min(...xs),z=Math.min(...zs),w=Math.max(1,Math.max(...xs)-x),h=Math.max(1,Math.max(...zs)-z);svg.setAttribute('viewBox',`${x-20} ${z-20} ${w+40} ${h+40}`);
 function polygon(poly,color){const node=doc.createElementNS(ns,'polygon');node.setAttribute('points',poly.map(p=>p.join(',')).join(' '));node.setAttribute('fill',color);svg.append(node);}
 for(const r of rows)if(r.kind==='park')polygon(r.poly,'#94ba75');
 // Opaque shared color avoids falsely encoding overlap as a comfort/density metric.
 for(const r of rows)for(const p of r.shadows)polygon(p,'#687782');
 for(const r of rows)if(r.kind!=='park')polygon(r.poly,'#e9dcc1');
 status.textContent=`${lighting?.hour?.toFixed(2)??input.value} visual hour · ${rows.length} loaded footprints · trees unavailable. Shadows clipped to atlas extent.`;
 }
 const change=()=>{onHour(Number(input.value));key='';update(simulationLighting(0,Number(input.value)));};
 const toggle=()=>{key='';update();};input.addEventListener('input',change);root.addEventListener('toggle',toggle);
 return {update,destroy(){destroyed=true;input.removeEventListener('input',change);root.removeEventListener('toggle',toggle);root.remove();}};
}
