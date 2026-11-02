// Server only. Responses structured outputs:
// https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses
import { requestProviderJson } from './provider.js';
export async function proposeOpenAIEdit({ context, schema, apiKey, model, fetchImpl, signal }) {
  const response = await requestProviderJson('https://api.openai.com/v1/responses', {
    headers: { authorization: `Bearer ${apiKey}` },
    body: { model, store: false, max_output_tokens: 4096, input: [{ role: 'system', content: context.instructions }, { role: 'user', content: JSON.stringify(context.data) }], text: { format: { type: 'json_schema', name: 'world_edit_envelope', strict: true, schema } } },
    fetchImpl, signal,
  });
  if (response.status && response.status !== 'completed') throw new Error('OpenAI returned an incomplete response');
  const blocks = (response.output || []).flatMap(item => item.content || []);
  if (blocks.some(block => block.type === 'refusal')) throw new Error('OpenAI declined this edit');
  return blocks.filter(block => block.type === 'output_text').map(block => block.text).join('') || response.output_text;
}
