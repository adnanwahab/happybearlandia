import { Database } from 'bun:sqlite';
import { mkdirSync, readdirSync, lstatSync, writeFileSync, realpathSync } from 'node:fs';
import { resolve, join, relative, dirname } from 'node:path';

/** Stop all writers first: each SQLite snapshot is consistent, cross-file atomicity needs quiescence. */
export function backupFutureMachine({cityRoot,sharePath,destination}) {
  const source=realpathSync(cityRoot),target=resolve(destination);
  const canonicalTarget=join(realpathSync(dirname(target)),target.split('/').at(-1));
  const child=relative(source,canonicalTarget);
  if(!child||(!child.startsWith('..')&&!child.startsWith('/')))throw new Error('Backup destination must be outside City storage');
  mkdirSync(target,{mode:0o700}); // Never overwrite an existing backup.
  const files=[];
  function snapshot(from,to){
    const db=new Database(from,{readonly:true});
    try{
      if(db.query('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error(`Integrity check failed: ${from}`);
      db.exec(`VACUUM INTO '${to.replaceAll("'","''")}'`);
      const restored=new Database(to,{readonly:true});try{if(restored.query('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('Backup verification failed');}finally{restored.close();}
      files.push(relative(target,to));
    }finally{db.close();}
  }
  function walk(from,to){mkdirSync(to,{recursive:true,mode:0o700});for(const name of readdirSync(from)){const path=join(from,name),stat=lstatSync(path);if(stat.isSymbolicLink())throw new Error('Storage symlinks are not supported');if(stat.isDirectory())walk(path,join(to,name));else if(name.endsWith('.sqlite'))snapshot(path,join(to,name));}}
  walk(source,join(target,'city'));
  if(sharePath)snapshot(realpathSync(sharePath),join(target,'reality-shares.sqlite'));
  const manifest={schemaVersion:'future-machine-backup.v1',createdAt:new Date().toISOString(),consistency:'SQLite-consistent files; operator must stop all writers for cross-file consistency',files};
  writeFileSync(join(target,'backup.json'),JSON.stringify(manifest,null,2),{mode:0o600});
  return manifest;
}
if(import.meta.main){const [cityRoot,sharePath,destination]=process.argv.slice(2);if(!cityRoot||!sharePath||!destination){console.error('Stop all server writers, then: bun scripts/backup-future-machine.js <city-directory> <share-sqlite-file> <new-backup-directory>');process.exitCode=1;}else{try{console.log(JSON.stringify(backupFutureMachine({cityRoot,sharePath,destination})));}catch(error){console.error(error.message);process.exitCode=1;}}}
