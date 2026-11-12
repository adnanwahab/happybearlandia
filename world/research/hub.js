import { INSTITUTIONS } from './institutions.js';
import { getExperience } from '../universe/registry.js';
import { contextFromURL, contextURL, shellURL } from '../universe/navigation.js';
let context;try { context=contextFromURL(location.href); } catch { document.querySelector('#context').textContent='Invalid context link. Return to Universe to start a valid selection.'; throw new Error('Invalid research context'); }
document.querySelector('#world').href=shellURL('world',context);
document.querySelector('nav a:last-child').href=contextURL('/',context);
document.querySelector('#context').textContent='Your browsing world and any selected experiment, run, branch, time and entity travel with each lab.';
for(const facility of INSTITUTIONS){const app=getExperience(facility.appId);if(!app)continue;const card=document.createElement('article');const h=document.createElement('h2');h.textContent=facility.name;card.append(h);for(const text of [facility.interactions,facility.limitations,facility.reference]){const p=document.createElement('p');p.textContent=text;card.append(p);}const a=document.createElement('a');a.textContent='Enter '+app.title+' →';a.href=contextURL(app.route,context);card.append(a);document.querySelector('#facilities').append(card);}
