import {verifyChallenge} from './contract.js';
self.onmessage=async({data})=>{try{const result=await verifyChallenge(data.envelope,{selection:data.selection},{onProgress:progress=>self.postMessage({type:'PROGRESS',progress})});self.postMessage({type:'RESULT',result});}catch(error){self.postMessage({type:'ERROR',error:error.message});}};
