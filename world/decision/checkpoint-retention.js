import {readdir,lstat,open,unlink,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';import {constants} from 'node:fs';
/** Bounded private-store audit. Children cannot outlive parents (repository invariant),
 * so expired-only removal cannot remove an ancestor of a retained child. */
export async function checkpointCapacity(directory,ownerId,{now=Date.now(),maxOwnerRecords=32,maxOwnerBytes=32*1024*1024,maxStoreBytes=128*1024*1024}={}) {
 const root=resolve(directory);await mkdir(root,{recursive:true,mode:0o700});const names=await readdir(root);if(names.length>2048)throw Error('Checkpoint store audit bound exceeded');
 let count=0,bytes=0,total=0,removed=0;
 for(const name of names){if(!/^[a-f0-9]{64}-[a-f0-9]{64}\.json$/.test(name))continue;const path=join(root,name),stat=await lstat(path);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>8*1024*1024+4096)throw Error('Invalid checkpoint storage entry');total+=stat.size;if(total>maxStoreBytes)throw Error('Checkpoint global storage limit reached');
 const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);let row;try{row=JSON.parse(await file.readFile('utf8'));}finally{await file.close();}
 if(!Number.isSafeInteger(row.expiresAt)||!row.scope?.ownerId)throw Error('Invalid retention envelope');
 if(row.expiresAt<=now){await unlink(path);removed++;continue;}
 if(row.scope.ownerId===ownerId){count++;bytes+=stat.size;}
 }
 if(count>=maxOwnerRecords||bytes>=maxOwnerBytes)throw Error('Checkpoint owner quota reached');
 return {count,bytes,removed,remainingBytes:maxOwnerBytes-bytes};
}
