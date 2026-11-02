// Server only. https://ai.google.dev/gemini-api/docs/generate-content/structured-output
import { requestProviderJson } from './provider.js';
export async function proposeGeminiEdit({ context, schema, apiKey, model, fetchImpl, signal }) {
  const response = await requestProviderJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    headers: { 'x-goog-api-key': apiKey },
    body: { systemInstruction: { parts: [{ text: context.instructions }] }, contents: [{ role: 'user', parts: [{ text: JSON.stringify(context.data) }] }], generationConfig: { maxOutputTokens: 4096, responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema } } } }, fetchImpl, signal,
  });
  const candidate = response.candidates?.[0];
  if (!candidate || candidate.finishReason !== 'STOP') throw new Error('Gemini declined or did not complete the edit');
  return (candidate.content?.parts || []).map(part => part.text || '').join('');
}
