import startup from './startup-smoke.config.js';

// Opt-in native WebKit coverage. Unsupported WebGPU is a real full-World
// acceptance failure; never substitute the static WebGL2 view for resident tests.
const port=process.env.HBL_WEBKIT_PORT||'43201';
const baseURL=`http://127.0.0.1:${port}`;
export default {
 ...startup,
 testMatch:['startup-smoke.e2e.js','temporal-recovery.e2e.js','temporal-recovery-integration.e2e.js','webkit-world-compat.e2e.js'],
 // Native World checks are separately opt-in because this host's WebKit lacks
 // WebGPU. Compatibility passes never imply that those native checks passed.
 grep:process.env.HBL_WEBKIT_NATIVE==='1'?undefined:/WebKit runs native|startup \/$|startup \/world\/future-machine|startup \/tools|startup \/routes|historical map recovers|empty historical|browser API error|object-history failure/,
 timeout:150000,
 outputDir:'../test-results/webkit-compat',
 reporter:[['list'],['json',{outputFile:`${process.cwd()}/test-results/webkit-compat/results.json`}]],
 use:{...startup.use,baseURL,browserName:'webkit',channel:undefined,launchOptions:{}},
 webServer:{...startup.webServer,url:`${baseURL}/api/health`,env:{...startup.webServer.env,PORT:port}},
 projects:[
  {name:'desktop',use:{viewport:{width:1440,height:1000}}},
  {name:'mobile',use:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}},
 ],
};
