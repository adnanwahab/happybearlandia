// Server only. https://platform.claude.com/docs/en/build-with-claude/structured-outputs
import { requestProviderJson } from './provider.js';
export async function proposeAnthropicEdit({ context, schema, apiKey, model, fetchImpl, signal }) {
  const response = await requestProviderJson('https://api.anthropic.com/v1/messages', {
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: { model, max_tokens: 4096, system: context.instructions, messages: [{ role: 'user', content: JSON.stringify(context.data) }], output_config: { format: { type: 'json_schema', schema } } }, fetchImpl, signal,
  });
  if (response.stop_reason && response.stop_reason !== 'end_turn') throw new Error('Anthropic did not complete the edit');
  return (response.content || []).filter(block => block.type === 'text').map(block => block.text).join('');
}
