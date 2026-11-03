/** Server-only compatibility for this project's existing ignored credentials.
 * Load only the selected provider's literal settings; process env wins. */
import {readFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {fileURLToPath} from 'node:url';
export function loadLocalOpenAISettings(env=process.env,{path=fileURLToPath(new URL('../../.env.op',import.meta.url)),read=readFileSync}={}){
 if(env.AI_PROVIDER!=='openai'||env.NODE_ENV==='production')return{loaded:false};
 let values;try{values=parseEnv(read(path,'utf8'));}catch{return{loaded:false};}
 let loaded=false;
 if(!env.OPENAI_API_KEY&&/^sk-[A-Za-z0-9_-]{16,}$/.test(values.OPENAI_API_KEY??'')){env.OPENAI_API_KEY=values.OPENAI_API_KEY;loaded=true;}
 if(!env.OPENAI_MODEL&&/^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,127}$/.test(values.OPENAI_MODEL??'')){env.OPENAI_MODEL=values.OPENAI_MODEL;loaded=true;}
 return{loaded};
}
