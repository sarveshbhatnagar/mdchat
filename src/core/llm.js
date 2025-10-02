// src/core/llm.js
import { generateText, streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { Ollama } from 'ollama';
import { loadConfig } from './config.js';

/**
 * Custom Ollama wrapper for AI SDK compatibility
 */
async function ollamaGenerate(model, prompt, baseURL) {
    const ollama = new Ollama({ host: baseURL || 'http://localhost:11434' });
    
    try {
        const response = await ollama.generate({
            model: model,
            prompt: prompt,
            stream: false
        });
        return response.response;
    } catch (error) {
        throw new Error(`Ollama error: ${error.message}. Make sure Ollama is running and the model '${model}' is installed.`);
    }
}

/**
 * Custom Ollama streaming wrapper
 */
async function* ollamaStream(model, prompt, baseURL) {
    const ollama = new Ollama({ host: baseURL || 'http://localhost:11434' });
    
    try {
        const response = await ollama.generate({
            model: model,
            prompt: prompt,
            stream: true
        });
        
        for await (const part of response) {
            if (part.response) {
                yield part.response;
            }
        }
    } catch (error) {
        throw new Error(`Ollama error: ${error.message}. Make sure Ollama is running and the model '${model}' is installed.`);
    }
}

/**
 * Get the configured model instance
 * @param {Object} cliOptions - CLI options for config override
 * @returns {Object} - Model instance or config for Ollama
 */
function getModel(cliOptions = {}) {
    const config = loadConfig();
    
    // CLI options override config file
    const provider = cliOptions.provider || config.provider || 'openai';
    const model = cliOptions.model || config.model || 'gpt-4o';
    const apiKey = cliOptions.apiKey || config.apiKey;
    const baseUrl = cliOptions.baseUrl || config.baseUrl;

    switch (provider) {
        case 'openai':
            // Set the environment variable directly if we have an API key from config
            if (apiKey && !process.env.OPENAI_API_KEY) {
                process.env.OPENAI_API_KEY = apiKey;
            }
            return { type: 'ai-sdk', model: openai(model) };
        case 'anthropic':
            // Set the environment variable directly if we have an API key from config  
            if (apiKey && !process.env.ANTHROPIC_API_KEY) {
                process.env.ANTHROPIC_API_KEY = apiKey;
            }
            return { type: 'ai-sdk', model: anthropic(model) };
        case 'ollama':
            return { type: 'ollama', model, baseUrl: baseUrl || 'http://localhost:11434' };
        default:
            console.warn(`⚠️ Provider ${provider} not yet supported, falling back to OpenAI`);
            const fallbackConfig = apiKey ? { apiKey } : {};
            return { type: 'ai-sdk', model: openai('gpt-4o', fallbackConfig) };
    }
}

/**
 * Ask an LLM using Vercel AI SDK or Ollama
 * @param {string} prompt - User input
 * @param {Object} cliOptions - CLI options for config override
 * @returns {Promise<string>} - Generated text
 */
export async function askLLM(prompt, cliOptions = {}) {
    const modelConfig = getModel(cliOptions);
    const systemPrompt = 'You are a helpful assistant that answers questions in markdown format. ' + 
        'Directly provide the markdown content without any extra commentary. Do not start with ```markdown or any other code block notation.';
    
    if (modelConfig.type === 'ollama') {
        const fullPrompt = `${systemPrompt}\n\nUser: ${prompt}\nAssistant:`;
        return await ollamaGenerate(modelConfig.model, fullPrompt, modelConfig.baseUrl);
    } else {
        const { text } = await generateText({
            model: modelConfig.model,
            system: systemPrompt,
            prompt: prompt,
        });
        return text;
    }
}


/**
 * Ask an LLM with streaming response
 * @param {string} prompt - User input
 * @param {Object} cliOptions - CLI options for config override
 * @returns {Promise<string>} - Complete generated text after streaming
 */
export async function askLLMStream(prompt, cliOptions = {}) {
    const modelConfig = getModel(cliOptions);
    const systemPrompt = 'You are a helpful assistant that answers questions in markdown format. ' + 
        'Directly provide the markdown content without any extra commentary. Do not start with ```markdown or any other code block notation.';

    let fullText = '';
    
    // Stream the response to console in real-time
    process.stdout.write('<!-- AI:answer -->\n');
    
    if (modelConfig.type === 'ollama') {
        const fullPrompt = `${systemPrompt}\n\nUser: ${prompt}\nAssistant:`;
        
        for await (const delta of ollamaStream(modelConfig.model, fullPrompt, modelConfig.baseUrl)) {
            process.stdout.write(delta);
            fullText += delta;
        }
    } else {
        const result = await streamText({
            model: modelConfig.model,
            system: systemPrompt,
            prompt: prompt,
        });

        for await (const delta of result.textStream) {
            process.stdout.write(delta);
            fullText += delta;
        }
    }
    
    process.stdout.write('\n<!-- /AI -->\n');
    
    return fullText;
}


export async function askLLMForMarkdownBlock(prompt, mdContent, cliOptions = {}) {
    const modelConfig = getModel(cliOptions);
    const systemPrompt = 'You help fill the markdown block provided based on the content in entire markdown file.';
    const fullPrompt = `The following is the content of a markdown file:\n\n${mdContent}\n\nBased on this content, Fill the following block - \n\n${prompt}`;
    
    if (modelConfig.type === 'ollama') {
        const combinedPrompt = `${systemPrompt}\n\n${fullPrompt}\n\nAssistant:`;
        return await ollamaGenerate(modelConfig.model, combinedPrompt, modelConfig.baseUrl);
    } else {
        const { text } = await generateText({
            model: modelConfig.model,
            system: systemPrompt,
            prompt: fullPrompt,
        });
        return text;
    }
}