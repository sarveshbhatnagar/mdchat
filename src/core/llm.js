// src/core/llm.js
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

/**
 * Ask an LLM using Vercel AI SDK
 * @param {string} prompt - User input
 * @param {Object} cliOptions - CLI options for config override
 * @returns {Promise<string>} - Generated text
 */
export async function askLLM(prompt, cliOptions = {}) {
    const { text } = await generateText({
        model: openai('gpt-4o'),
        system: 'You are a helpful assistant that answers questions in markdown format. ' + 
        'Directly provide the markdown content without any extra commentary. Do not start with ```markdown or any other code block notation.',
        prompt: prompt,
      });
    return text;
}


export async function askLLMForMarkdownBlock(prompt, mdContent, cliOptions = {}) {
    const { text } = await generateText({
        model: openai('gpt-4o'),
        system: 'You help fill the markdown block provided based on the content in entire markdown file.',
        prompt: `The following is the content of a markdown file:\n\n${mdContent}\n\nBased on this content, Fill the following block - \n\n${prompt}`,
      });
    return text;
}