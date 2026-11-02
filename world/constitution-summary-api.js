import { proposeOpenAIEdit } from './ai/openai.js';
import { proposeAnthropicEdit } from './ai/anthropic.js';
import { compactConstitutionResult, localConstitutionSummary } from './constitution-summary.js';
export async function handleConstitutionSummary(request, { env = process.env, providers = { openai: proposeOpenAIEdit, anthropic: proposeAnthropicEdit } } = {}) {
  if (request.method!=='POST') return Response.json({error:'Use POST'},{status:405,headers:{allow:'POST'}});
  try {
    const raw=await request.text();
    if(raw.length>64000) return Response.json({error:'Summary input too large'},{status:413});
    const facts=compactConstitutionResult(JSON.parse(raw));
    let summary=localConstitutionSummary(facts), source='local';
    const provider = env.OPENAI_API_KEY && env.OPENAI_MODEL ? 'openai' : env.ANTHROPIC_API_KEY && env.ANTHROPIC_MODEL ? 'anthropic' : null;
    if(provider) try {
      const prefix=provider.toUpperCase();
      const raw=await providers[provider]({apiKey:env[prefix+'_API_KEY'],model:env[prefix+'_MODEL'],signal:AbortSignal.timeout(12000),schema:{type:'object',properties:{summary:{type:'string'}},required:['summary'],additionalProperties:false},context:{instructions:'Write one neutral paragraph using only the supplied simulation facts. Include uncertainty and paired p10–p90 spread, which is not a confidence interval. Do not invent causal claims or recommend passing or rejecting a law. Identify physical infrastructure rendering as schematic, not engineering designs or exact construction locations. Identify outcomes as illustrative synthetic counterfactuals, not forecasts. Unsupported policies have no modeled effect. Return JSON with summary.',data:facts}});
      const generated=JSON.parse(raw).summary;
      if(typeof generated==='string' && generated.length>40 && generated.length<4000){summary=generated;source=provider;}
    } catch { /* Provider outages always retain the deterministic summary. */ }
    return Response.json({summary,source},{headers:{'cache-control':'no-store'}});
  } catch(error) {return Response.json({error:error.message},{status:400});}
}
