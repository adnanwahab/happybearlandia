import {compareNeighborhood} from './model.js';
self.onmessage=async event=>{
  try {
    const result=await compareNeighborhood(event.data,{onProgress:progress=>self.postMessage({type:'progress',progress:progress.completed/progress.total}),yieldControl:()=>new Promise(resolve=>setTimeout(resolve,0))});
    self.postMessage({type:'result',result});
  }catch(error){self.postMessage({type:'error',error:error.message});}
};
