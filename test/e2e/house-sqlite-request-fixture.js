/** One real handler request per process; reopening proves disk-backed persistence. */
import {createWorldPersistenceHandler} from '../../world/experiments/persistence-api.js';
const input=JSON.parse(await Bun.stdin.text()),handler=createWorldPersistenceHandler({dbPath:process.argv[2],idFactory:()=> 'guestqa1',maxRecords:1,lookupHomeAddress:async()=>null});
try{const response=await handler(new Request(input.url,{method:input.method??'GET',headers:input.headers??{},...(input.body===undefined||input.body===null?{}:{body:input.body})}));process.stdout.write(JSON.stringify({status:response.status,body:await response.text()}));}finally{handler.close();}
