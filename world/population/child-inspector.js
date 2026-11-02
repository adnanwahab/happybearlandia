/** Read-only inspection of worker-supplied child and guardian records. */
export function childInspectorRows(person){
 if(!person)return[];const child=person.child,rows=[];
 if(person.ageYears!==undefined)rows.push(['Age (years)',person.ageYears]);
 if(child){for(const [label,key]of [['Parents','parentIds'],['Seeded peers','friendIds'],['School district','schoolDistrictId'],['School location','schoolLocationId'],['School anchor source','schoolLocationSource'],['Care enrolled','careEnrolled'],['Camp enrolled','campEnrolled'],['Current schedule','currentSchedule'],['Transport permissions','permissions'],['Recorded exposure counters','counters'],['Fatigue proxy (not health)','fatigueProxy'],['Academic exposure proxy (not grades)','academicExposureProxy']])if(child[key]!==undefined)rows.push([label,child[key]]);}
 for(const [label,key]of [['Guardian care constraint','parentCare'],['Labor availability','laborAvailability'],['Daily care work fraction','careWorkFraction']])if(person[key]!==undefined)rows.push([label,person[key]]);
 return rows;
}
export function mountChildInspector(container,{onSelect}={}){
 const doc=container.ownerDocument,root=doc.createElement('section');root.className='population-child-inspector';container.append(root);
 const link=doc.createElement('link');link.rel='stylesheet';link.href=new URL('./child-inspector.css',import.meta.url).href;(doc.head||container).append(link);
 function update(person){root.replaceChildren();root.hidden=!person?.child&&!person?.parentCare;if(root.hidden)return;const h=doc.createElement('h4');h.textContent=person.child?'Recorded child routine & family':'Recorded guardian care constraint';root.append(h);const dl=doc.createElement('dl');root.append(dl);for(const [label,value]of childInspectorRows(person)){const dt=doc.createElement('dt'),dd=doc.createElement('dd');dt.textContent=label;dd.textContent=value===null?'Not recorded':typeof value==='object'?JSON.stringify(value):String(value);dl.append(dt,dd);}for(const id of [...(person.child?.parentIds??[]),...(person.child?.friendIds??[]),...(person.parentCare?.children??[])]){const b=doc.createElement('button');b.type='button';b.textContent='Inspect '+id;b.addEventListener('click',()=>onSelect?.(id));root.append(b);}const note=doc.createElement('p');note.textContent='Synthetic family and schedule records. Exposure proxies are not measured educational or health outcomes. Missing locations do not imply school footprints.';root.append(note);for(const [key,value]of Object.entries(person.child?.assumptions??{})){const p=doc.createElement('p');p.textContent=key+': '+value;root.append(p);}}
 return{update,destroy(){root.remove();link.remove();}};
}
