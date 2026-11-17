import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

export const sha256 = value=>createHash('sha256').update(value).digest('hex');
export function sourceIdentity(){
  // Hash actual checkout contents, including untracked implementation files.
  // Exclude artifacts and credentials; do not read or print environment values.
  const tracked=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0');
  const untracked=execFileSync('git',['ls-files','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0');
  const files=[...new Set([...tracked,...untracked])].filter(p=>p&&
    /^(world\/|shared\/|test\/|scripts\/|index\.|server\.|package.json$|bun.lock$)/.test(p)).sort();
  const hash=createHash('sha256');
  for(const file of files){hash.update(file+'\0');try{hash.update(readFileSync(file));}catch{hash.update('[missing]');}}
  return {revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
    fingerprint:hash.digest('hex'),files:files.length};
}
