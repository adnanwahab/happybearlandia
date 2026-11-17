import startup from './startup-smoke.config.js';
export default {...startup,testMatch:'sidewalk-sync.e2e.js',timeout:150000,outputDir:'../test-results/sidewalk-sync',reporter:'list',projects:[{name:'desktop',use:{viewport:{width:1440,height:1000}}},{name:'mobile',use:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}}]};
