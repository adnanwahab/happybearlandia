import {WORKER_PROTOCOL} from '../../world/workers/protocol.js';
self.postMessage({protocol:WORKER_PROTOCOL,type:'WORKER_READY'});
self.onmessage=async({data})=>{self.postMessage({protocol:WORKER_PROTOCOL,type:'TASK_START',taskId:data.taskId});if(data.kind==='crash')throw new Error('deliberate worker crash');if(data.payload?.delay)await new Promise(resolve=>setTimeout(resolve,data.payload.delay));self.postMessage({protocol:WORKER_PROTOCOL,type:'TASK_DONE',taskId:data.taskId,result:data.payload?.value??data.payload});};
