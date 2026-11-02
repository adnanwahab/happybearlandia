import {compareLaw} from './comparison.js';
self.onmessage=async({data})=>{try{const result=await compareLaw({...data,onProgress:progress=>self.postMessage({type:'PROGRESS',progress})});self.postMessage({type:'RESULT',result});}catch(error){self.postMessage({type:'ERROR',error:error.message});}};
