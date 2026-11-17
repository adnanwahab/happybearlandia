import {Database} from 'bun:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {createGuestHandler} from '../../world/guest/api.js';
import {createCity} from '../../world/city/seed.js';
import {normalizeRealityRequest,simulateRealityPair} from '../../world/reality/runtime-core.js';
if(!process.env.HBL_GUEST_DB_PATH)throw Error('Fixture requires an isolated guest database');
const guest=createGuestHandler({dbPath:process.env.HBL_GUEST_DB_PATH,maxRecords:1});
const guestDb=new Database(process.env.HBL_GUEST_DB_PATH,{readonly:true});
const manifest=normalizeRealityRequest({initial:createCity({households:3}),program:{engine:'city',parameterPatch:{permits:6}},runs:1,months:1,seed:42,parameterUncertainty:[]});
const guestInput={manifest,run:await simulateRealityPair(manifest,0),publishConsent:true,rightsConfirmed:true,ttlSeconds:60};
mkdirSync(dirname(process.env.HBL_WORLD_DB_PATH),{recursive:true});
const db=new Database(process.env.HBL_WORLD_DB_PATH,{create:true});db.exec('CREATE TABLE receipts (id TEXT)');
const server=Bun.serve({port:Number(process.env.PORT),hostname:process.env.HBL_BIND_HOST,
 fetch(request){
  if(new URL(request.url).pathname==='/api/guest-snapshots')return guest(request);
  if(new URL(request.url).pathname==='/record')db.query('INSERT INTO receipts VALUES (?)').run(process.env.HBL_BROWSER_ISOLATION_ID);
  return Response.json({id:process.env.HBL_BROWSER_ISOLATION_ID,count:db.query('SELECT COUNT(*) AS count FROM receipts').get().count,port:server.port,host:server.hostname,worldDb:process.env.HBL_WORLD_DB_PATH,guestDb:process.env.HBL_GUEST_DB_PATH,guestCount:guestDb.query('SELECT COUNT(*) AS count FROM guest_snapshots').get().count,guestInput});
 }});
process.on('SIGTERM',()=>{server.stop(true);db.close();guestDb.close();guest.close();process.exit(0);});
