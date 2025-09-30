// src/core/llm.js
import { generateText, streamText } from 'ai';
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

/**
 * Ask an LLM with streaming response
 * @param {string} prompt - User input
 * @param {Object} cliOptions - CLI options for config override
 * @returns {Promise<string>} - Complete generated text after streaming
 */
export async function askLLMStream(prompt, cliOptions = {}) {
    const result = await streamText({
        model: openai('gpt-4o'),
        system: 'You are a helpful assistant that answers questions in markdown format. ' + 
        'Directly provide the markdown content without any extra commentary. Do not start with ```markdown or any other code block notation.',
        prompt: prompt,
    });

    let fullText = '';
    
    // Stream the response to console in real-time
    process.stdout.write('<!-- AI:answer -->\n');
    
    for await (const delta of result.textStream) {
        process.stdout.write(delta);
        fullText += delta;
    }
    
    process.stdout.write('\n<!-- /AI -->\n');
    
    return fullText;
}


export async function askLLMForMarkdownBlock(prompt, mdContent, cliOptions = {}) {
    const { text } = await generateText({
        model: openai('gpt-4o'),
        system: 'You help fill the markdown block provided based on the content in entire markdown file.',
        prompt: `The following is the content of a markdown file:\n\n${mdContent}\n\nBased on this content, Fill the following block - \n\n${prompt}`,
      });
    return text;
}