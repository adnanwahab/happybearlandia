import {BROWSER_CONTEXT_ENV} from './browser-environment.js';

/** Worker handoff happens at Playwright setup, never while importing configs. */
export default function setup(config){
 const environments=config.metadata.browserEnvironments;
 if(!Array.isArray(environments)||!environments.length)throw new Error('Browser config metadata must include its browserEnvironments.');
 const previous=process.env[BROWSER_CONTEXT_ENV];
 process.env[BROWSER_CONTEXT_ENV]=JSON.stringify({version:1,environments});
 return()=>{
  if(previous===undefined)delete process.env[BROWSER_CONTEXT_ENV];else process.env[BROWSER_CONTEXT_ENV]=previous;
 };
}
