// src/commands/summarize.js
import fs from "fs";
import path from "path";
import { askLLM } from "../core/llm.js";

// Approximate token estimation (rough: 1 token ≈ 4 characters)
const estimateTokens = (text) => Math.ceil(text.length / 4);

// Maximum tokens to send to LLM (leaving room for response)
const MAX_INPUT_TOKENS = 15000;
const MAX_CHUNK_SIZE = MAX_INPUT_TOKENS * 4;

export default async function summarize(input, options = {}) {
  try {
    // Extract CLI config options
    const { provider, model, apiKey, baseUrl, ...otherOptions } = options;
    const cliConfig = { provider, model, apiKey, baseUrl };
    
    let content = "";
    let isFile = false;
    
    // Check if input is a file path or direct text
    if (fs.existsSync(input)) {
      isFile = true;
      const stats = fs.statSync(input);
      const fileSizeMB = stats.size / (1024 * 1024);
      
      console.log(`📄 Reading content from: ${input} (${fileSizeMB.toFixed(2)} MB)`);
      
      // For very large files, warn the user
      if (fileSizeMB > 10) {
        console.log(`⚠️  Large file detected. This may take some time to process...`);
      }
      
      // Read file asynchronously for better performance
      content = await fs.promises.readFile(input, "utf8");
    } else {
      // Treat input as direct text
      content = input;
    }

    const contentTokens = estimateTokens(content);
    console.log(`📊 Estimated tokens: ${contentTokens.toLocaleString()}`);

    let summary;
    
    if (contentTokens <= MAX_INPUT_TOKENS) {
      // Content fits within token limit - process normally
      summary = await summarizeSingleChunk(content, cliConfig);
    } else {
      // Content is too large - use chunking strategy
      console.log(`🔄 Content exceeds token limit. Using chunked summarization...`);
      summary = await summarizeInChunks(content, cliConfig, isFile ? path.basename(input) : "text");
    }

    const block = `<!-- AI:summary -->\n${summary}\n<!-- /AI -->\n`;

    if (otherOptions.output) {
      const header = isFile 
        ? `\n\n## Summary of ${input}\n\n${block}`
        : `\n\n## Summary\n\n${block}`;
      
      await fs.promises.appendFile(otherOptions.output, header);
      console.log(`✔ Summary appended to ${otherOptions.output}`);
    } else {
      console.log(block);
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error("❌ Error: File not found:", input);
    } else if (err.code === 'EISDIR') {
      console.error("❌ Error: Cannot summarize a directory:", input);
    } else if (err.code === 'EACCES') {
      console.error("❌ Error: Permission denied:", input);
    } else {
      console.error("❌ Error:", err.message);
    }
    process.exit(1);
  }
}

/**
 * Summarize content that fits within token limits
 */
async function summarizeSingleChunk(content, cliConfig) {
  const prompt = `Please summarize the following content. Focus on the key points, main ideas, and important takeaways. Be concise but comprehensive:

${content}`;

  return await askLLM(prompt, cliConfig);
}

/**
 * Summarize large content by breaking it into chunks
 */
async function summarizeInChunks(content, cliConfig, filename) {
  const chunks = splitIntoChunks(content, MAX_CHUNK_SIZE);
  console.log(`📝 Processing ${chunks.length} chunks...`);
  
  const chunkSummaries = [];
  
  // Process each chunk
  for (let i = 0; i < chunks.length; i++) {
    console.log(`🔄 Processing chunk ${i + 1}/${chunks.length}...`);
    
    const prompt = `Please summarize this section (part ${i + 1} of ${chunks.length}) from ${filename}. Focus on key points and main ideas:

${chunks[i]}`;

    const chunkSummary = await askLLM(prompt, cliConfig);
    chunkSummaries.push(`**Part ${i + 1}:**\n${chunkSummary}`);
    
    // Small delay to be respectful to API rate limits
    if (i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // Create final summary from all chunk summaries
  console.log(`🔄 Creating final comprehensive summary...`);
  const combinedSummaries = chunkSummaries.join('\n\n');
  
  const finalPrompt = `Please create a comprehensive summary from these section summaries of ${filename}. Combine and synthesize the key points into a cohesive overview:

${combinedSummaries}`;

  return await askLLM(finalPrompt, cliConfig);
}

/**
 * Split content into chunks that respect sentence boundaries
 */
function splitIntoChunks(content, maxChunkSize) {
  const chunks = [];
  const sentences = content.split(/(?<=[.!?])\s+/);
  
  let currentChunk = "";
  
  for (const sentence of sentences) {
    // If adding this sentence would exceed the limit
    if (currentChunk.length + sentence.length > maxChunkSize) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        // Single sentence is too long - split by paragraphs or words
        const subChunks = splitLongSentence(sentence, maxChunkSize);
        chunks.push(...subChunks);
      }
    } else {
      currentChunk += (currentChunk.length > 0 ? " " : "") + sentence;
    }
  }
  
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.filter(chunk => chunk.length > 0);
}

/**
 * Split very long sentences by paragraphs or words
 */
function splitLongSentence(sentence, maxSize) {
  if (sentence.length <= maxSize) {
    return [sentence];
  }
  
  // Try splitting by paragraphs first
  const paragraphs = sentence.split(/\n\s*\n/);
  if (paragraphs.length > 1) {
    const chunks = [];
    for (const paragraph of paragraphs) {
      chunks.push(...splitLongSentence(paragraph, maxSize));
    }
    return chunks;
  }
  
  // Fall back to splitting by words
  const words = sentence.split(/\s+/);
  const chunks = [];
  let currentChunk = "";
  
  for (const word of words) {
    if (currentChunk.length + word.length + 1 > maxSize) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = word;
      } else {
        // Single word is too long - just include it
        chunks.push(word);
      }
    } else {
      currentChunk += (currentChunk.length > 0 ? " " : "") + word;
    }
  }
  
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}
