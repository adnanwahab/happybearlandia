import {inspectProject,compareProjectFix} from './unblock.js';
self.onmessage=({data})=>{
  try {self.postMessage({result:data.type==='inspect'?inspectProject(data.state,data.projectId):compareProjectFix(data)});}
  catch(error){self.postMessage({error:error.message});}
};
