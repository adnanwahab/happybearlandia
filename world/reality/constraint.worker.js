import {inspectConstraints,compareConstraintChange} from './constraint-core.js';
self.onmessage=async({data})=>{try{const result=data.type==='inspect'?inspectConstraints(data.state,data.target):await compareConstraintChange(data);postMessage({result});}catch(error){postMessage({error:error.message});}};
