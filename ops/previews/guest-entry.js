// Trusted recipe. The selected server never receives host credentials or network.
import {mkdirSync} from 'node:fs';
try{mkdirSync('/tmp/.preview-started');}catch{process.exit(0);}
import {spawnSync} from 'node:child_process';
const unpack=spawnSync('/bin/tar',['-xf','/payload/bundle.tar','-C','/app'],{stdio:'inherit'});
if(unpack.status!==0)process.exit(1);
process.chdir('/app');
// Explicit argv, no package lifecycle/build/start scripts, no shell.
const child=Bun.spawn(['/usr/local/bin/bun','/app/server.js'],{cwd:'/app',env:{PATH:'/usr/local/bin:/usr/bin:/bin',HOME:'/tmp',PORT:'3000',NODE_ENV:'development',HBL_BUILD_ID:process.env.HBL_BUILD_ID, HBL_WORLD_DB_PATH:'/tmp/world.sqlite',DECISION_STORE_DIR:'/tmp/decision',HBL_CITY_DATA_DIR:'/tmp/city',HBL_REALITY_SHARE_DB_PATH:'/tmp/share.sqlite'},stdout:'inherit',stderr:'inherit'});
process.on('SIGTERM',()=>child.kill('SIGTERM'));
process.exit(await child.exited);
