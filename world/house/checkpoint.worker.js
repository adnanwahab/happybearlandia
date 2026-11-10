import {runHouseCheckpointTask} from './checkpoint-tasks.js';
self.onmessage=({data})=>{try{self.postMessage({result:runHouseCheckpointTask(data)});}catch(error){self.postMessage({error:error.message});}};
