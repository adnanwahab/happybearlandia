import {pathToFileURL} from 'node:url';
import {resolve,dirname,join} from 'node:path';
import {createBrowserEnvironment,BROWSER_CONTEXT_ENV} from '../test/support/browser-environment.js';

const input=JSON.parse(process.env.HBL_BROWSER_JOB_CONFIG||'null');
if(!input)throw Error('Use scripts/run-symphony-browser-tests.mjs to configure this job.');
const base=(await import(pathToFileURL(input.config).href)).default;
const sourceDirectory=dirname(input.config);
const sourceProject=base.projects?.find(project=>project.name===input.device);
if(base.projects?.length&&!sourceProject)throw Error('Suite needs an explicit device project adapter.');
if(base.globalSetup&&!String(base.globalSetup).endsWith('browser-global-setup.js'))throw Error('Suite needs an explicit globalSetup adapter; refusing to discard setup.');
const {wsEndpoint,...publicJob}=input;
const serverList=base.webServer?(Array.isArray(base.webServer)?base.webServer:[base.webServer]):[];
if(serverList.length!==1||!/\bserver\.js\b/.test(serverList[0].command))throw Error('Browser job requires one repository server.js webServer; custom servers need an explicit isolated adapter.');
const isolated=createBrowserEnvironment({name:'symphony-job',env:{TEST_WORKER_INDEX:process.env.TEST_WORKER_INDEX,[BROWSER_CONTEXT_ENV]:process.env[BROWSER_CONTEXT_ENV]}});
const previousURL=new URL(serverList[0].url);
const webServer={...serverList[0],cwd:process.cwd(),url:isolated.baseURL+previousURL.pathname,reuseExistingServer:false,
 env:{...serverList[0].env,...isolated.serverEnv}};
const browserName=input.engine==='installed-chrome'?'chromium':input.engine;
export default {...base,testDir:resolve(sourceDirectory,base.testDir||'.'),
 globalSetup:resolve('test/support/browser-global-setup.js'),
 metadata:{...base.metadata,browserEnvironments:[...(base.metadata?.browserEnvironments||[]),isolated.descriptor],browserJob:publicJob},
 workers:1,retries:0,fullyParallel:false,
 outputDir:join(input.artifacts,'tests'),reporter:[['list'],['json',{outputFile:join(input.artifacts,'results.json')}]],
 use:{...base.use,baseURL:isolated.baseURL,trace:'on',screenshot:'on'},
 projects:[{name:input.device,use:{...sourceProject?.use,browserName,channel:undefined,
 viewport:input.device==='mobile'?{width:390,height:844}:{width:1440,height:1000},
 isMobile:input.device==='mobile'&&browserName!=='firefox',hasTouch:input.device==='mobile',
 connectOptions:{wsEndpoint:input.wsEndpoint}}}],webServer};
