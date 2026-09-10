import { GoogleGenAI } from '@google/genai';
import type { Interactions } from '@google/genai';

const ai = new GoogleGenAI({
    apiKey: process.env['GEMINI_API_KEY'],
});

const tools: Interactions.Tool[] = [
    {
        type: 'google_search',
    },
];

const generationConfig = {
    max_output_tokens: 65536,
    topP: 0.95,
    thinkingLevel: 'medium',
};

async function main() {
    const interaction = await ai.interactions.create({
        model: 'models/gemini-3.8-flash',
        input: 'INSERT_INPUT_HERE',
        tools: tools,
        generation_config: generationConfig,
    });

    console.log(interaction.steps?.at(-1));
}

main();
