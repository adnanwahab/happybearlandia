import {mountJury} from './view.js';
const jury=mountJury(document.getElementById('zoning-jury'));
addEventListener('pagehide',event=>{if(!event.persisted)jury.destroy();});
