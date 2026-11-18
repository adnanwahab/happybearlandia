// Operator-only CLI. Never imported by the browser or normal test runner.
import { proposeWorldEdit } from '../../ai/provider.js';
import { createHousingScenarios, housingModel } from '../../models/housing/index.js';
export async function validateLive({env = process.env, fetchImpl = fetch} = {}) {
  const provider = env.HBL_LIVE_PROVIDER;
  if (env.HBL_AUTHORIZE_PAID_VALIDATION !== 'I_AUTHORIZE_ONE_PAID_REQUEST') return {status:'skipped', calls:0};
  const prefix = {openai:'OPENAI',anthropic:'ANTHROPIC',gemini:'GEMINI'}[provider];
  if (!prefix || !env[`${prefix}_API_KEY`]?.trim() || !env[`${prefix}_MODEL`]?.trim()) return {status:'configuration-required',calls:0};
  let calls=0;
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(), 10000);
  try {
    const input={schemaVersion:'decision-experiment.v1',name:'Synthetic compatibility check',decision:'Housing policy',modelId:housingModel.id,modelVersion:housingModel.version,seed:42,runs:10,years:10,scenarios:createHousingScenarios(),metadata:{}};
    await proposeWorldEdit({prompt:'Make construction capacity 20% higher',worldState:input,scenario:input.scenarios[1],provider,env,timeoutMs:10000,fetchImpl:(url,init)=>{
      if (++calls>1) throw Error('budget');
      return fetchImpl(url,{...init,signal:AbortSignal.any([init.signal,controller.signal])});
    }});
    return {status:'validated-proposal',provider,calls};
  } catch { return {status:'validation-failed',provider,calls}; }
  finally {clearTimeout(timer);}
}
if(import.meta.main) console.log(JSON.stringify(await validateLive()));
