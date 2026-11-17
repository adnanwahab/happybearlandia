import {Database} from 'bun:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
mkdirSync(dirname(process.env.HBL_WORLD_DB_PATH),{recursive:true});
const db=new Database(process.env.HBL_WORLD_DB_PATH,{create:true});db.exec('CREATE TABLE receipts (id TEXT)');
const server=Bun.serve({port:Number(process.env.PORT),hostname:process.env.HBL_BIND_HOST,
 fetch(request){
  if(new URL(request.url).pathname==='/record')db.query('INSERT INTO receipts VALUES (?)').run(process.env.HBL_BROWSER_ISOLATION_ID);
  return Response.json({id:process.env.HBL_BROWSER_ISOLATION_ID,count:db.query('SELECT COUNT(*) AS count FROM receipts').get().count,port:server.port,host:server.hostname,worldDb:process.env.HBL_WORLD_DB_PATH});
 }});
process.on('SIGTERM',()=>{server.stop(true);db.close();process.exit(0);});
