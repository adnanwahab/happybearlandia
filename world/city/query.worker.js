import {queryDatabase} from './storage.js';
self.onmessage=({data})=>{try{self.postMessage({result:queryDatabase(data.path,data.sql)});}catch(error){self.postMessage({error:error.message});}};
