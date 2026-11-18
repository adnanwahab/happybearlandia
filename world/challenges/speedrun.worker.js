import {runSpeedrun} from './speedrun.js';
self.onmessage=async({data})=>{
 try{self.postMessage({type:'RESULT',receipt:await runSpeedrun(data.envelope,data.selection)});}
 catch(error){self.postMessage({type:'ERROR',error:error.message});}
};
