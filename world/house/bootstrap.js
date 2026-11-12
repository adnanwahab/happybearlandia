import {guardHouseScreen} from './screen-guard.js';
const container=document.querySelector('#house-app');
if(container){const guard=guardHouseScreen(container);try{await import('./app.js');await window.hblHouseStartup;guard.check();}catch(error){guard.fail(error);}}
