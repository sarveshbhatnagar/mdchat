// src/commands/summarize.js
import fs from "fs";
import path from "path";
import { glob } from "glob";
import { askLLM } from "../core/llm.js";

// Approximate token estimation (rough: 1 token ≈ 4 characters)
const estimateTokens = (text) => Math.ceil(text.length / 4);

// Maximum tokens to send to LLM (leaving room for response)
const MAX_INPUT_TOKENS = 15000;
const MAX_CHUNK_SIZE = MAX_INPUT_TOKENS * 4;

// File extensions to consider for text summarization
const TEXT_EXTENSIONS = ['.md', '.txt', '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h', '.css', '.html', '.xml', '.json', '.yaml', '.yml', '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd', '.sql', '.r', '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.scala', '.clj', '.hs', '.elm', '.vue', '.svelte', '.tex', '.org', '.rst', '.adoc'];

export default async function summarize(input, options = {}) {
  try {
    // Extract CLI config options
    const { provider, model, apiKey, baseUrl, ...otherOptions } = options;
    const cliConfig = { provider, model, apiKey, baseUrl };
    
    // Determine if input is a glob pattern, directory, or single file/text
    const files = await resolveInputFiles(input);
    
    if (files.length === 0) {
      console.log("⚠️  No files found matching the input criteria.");
      return;
    }
    
    if (files.length === 1 && files[0] !== null) {
      // Single file processing (existing logic)
      await processSingleInput(input, files[0], cliConfig, otherOptions);
    } else if (files.length === 1 && files[0] === null) {
      // Direct text input
      await processSingleInput(input, null, cliConfig, otherOptions);
    } else {
      // Multiple files processing
      await processMultipleFiles(files, cliConfig, otherOptions);
    }
    
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

/**
 * Resolve input to a list of files to process
 */
async function resolveInputFiles(input) {
  try {
    const stats = fs.statSync(input);
    
    if (stats.isDirectory()) {
      // Directory: find all text files
      console.log(`📁 Scanning directory: ${input}`);
      const pattern = path.join(input, '**/*').replace(/\\/g, '/');
      const allFiles = await glob(pattern, { nodir: true });
      
      // Filter for text files
      const textFiles = allFiles.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return TEXT_EXTENSIONS.includes(ext);
      });
      
      console.log(`📄 Found ${textFiles.length} text files in directory`);
      return textFiles;
      
    } else if (stats.isFile()) {
      // Single file
      return [input];
    }
  } catch (err) {
    // Not a file or directory, check if it's a glob pattern
    if (input.includes('*') || input.includes('?') || input.includes('[')) {
      console.log(`🔍 Processing glob pattern: ${input}`);
      const matchedFiles = await glob(input, { nodir: true });
      
      // Filter for text files
      const textFiles = matchedFiles.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return TEXT_EXTENSIONS.includes(ext);
      });
      
      console.log(`📄 Found ${textFiles.length} files matching pattern`);
      return textFiles;
    } else {
      // Treat as direct text input
      return [null]; // null indicates direct text
    }
  }
  
  return [];
}

/**
 * Process a single input (file or text)
 */
async function processSingleInput(originalInput, filePath, cliConfig, otherOptions) {
  let content = "";
  let isFile = false;
  let displayName = originalInput;
  
  if (filePath) {
    // File input
    isFile = true;
    const stats = fs.statSync(filePath);
    const fileSizeMB = stats.size / (1024 * 1024);
    
    console.log(`📄 Reading content from: ${filePath} (${fileSizeMB.toFixed(2)} MB)`);
    
    if (fileSizeMB > 10) {
      console.log(`⚠️  Large file detected. This may take some time to process...`);
    }
    
    content = await fs.promises.readFile(filePath, "utf8");
    displayName = filePath;
  } else {
    // Direct text input
    content = originalInput;
    displayName = "text input";
  }

  const contentTokens = estimateTokens(content);
  console.log(`📊 Estimated tokens: ${contentTokens.toLocaleString()}`);

  let summary;
  
  if (contentTokens <= MAX_INPUT_TOKENS) {
    summary = await summarizeSingleChunk(content, cliConfig);
  } else {
    console.log(`🔄 Content exceeds token limit. Using chunked summarization...`);
    summary = await summarizeInChunks(content, cliConfig, isFile ? path.basename(filePath) : "text");
  }

  const block = `<!-- AI:summary -->\n${summary}\n<!-- /AI -->\n`;

  if (otherOptions.output) {
    const header = isFile 
      ? `\n\n## Summary of ${displayName}\n\n${block}`
      : `\n\n## Summary\n\n${block}`;
    
    await fs.promises.appendFile(otherOptions.output, header);
    console.log(`✔ Summary appended to ${otherOptions.output}`);
  } else {
    console.log(block);
  }
}

/**
 * Process multiple files
 */
async function processMultipleFiles(files, cliConfig, otherOptions) {
  console.log(`🔄 Processing ${files.length} files...`);
  
  const summaries = [];
  const processedFiles = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileName = path.basename(file);
    
    console.log(`\n📄 [${i + 1}/${files.length}] Processing: ${fileName}`);
    
    try {
      const stats = fs.statSync(file);
      const fileSizeMB = stats.size / (1024 * 1024);
      
      // Skip very large files in batch mode
      if (fileSizeMB > 50) {
        console.log(`⚠️  Skipping ${fileName} (${fileSizeMB.toFixed(2)} MB - too large for batch processing)`);
        continue;
      }
      
      const content = await fs.promises.readFile(file, "utf8");
      const contentTokens = estimateTokens(content);
      
      console.log(`📊 Tokens: ${contentTokens.toLocaleString()}`);
      
      let summary;
      if (contentTokens <= MAX_INPUT_TOKENS) {
        summary = await summarizeSingleChunk(content, cliConfig);
      } else {
        console.log(`🔄 Using chunked summarization for ${fileName}...`);
        summary = await summarizeInChunks(content, cliConfig, fileName);
      }
      
      summaries.push({
        file: file,
        fileName: fileName,
        summary: summary,
        tokens: contentTokens
      });
      
      processedFiles.push(file);
      
      // Small delay between files to be respectful to API limits
      if (i < files.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (err) {
      console.log(`❌ Error processing ${fileName}: ${err.message}`);
      continue;
    }
  }
  
  // Generate combined summary or individual summaries
  if (otherOptions.combine || files.length > 10) {
    await generateCombinedSummary(summaries, cliConfig, otherOptions);
  } else {
    await generateIndividualSummaries(summaries, otherOptions);
  }
  
  console.log(`\n✅ Completed processing ${processedFiles.length}/${files.length} files`);
}

/**
 * Generate individual summaries for each file
 */
async function generateIndividualSummaries(summaries, otherOptions) {
  console.log(`\n📝 Generating individual summaries...`);
  
  for (const { file, fileName, summary, tokens } of summaries) {
    const block = `<!-- AI:summary -->\n${summary}\n<!-- /AI -->\n`;
    
    if (otherOptions.output) {
      const header = `\n\n## Summary of ${fileName}\n*File: ${file}* | *Tokens: ${tokens.toLocaleString()}*\n\n${block}`;
      await fs.promises.appendFile(otherOptions.output, header);
    } else {
      console.log(`\n## ${fileName}`);
      console.log(`*File: ${file}* | *Tokens: ${tokens.toLocaleString()}*`);
      console.log(block);
    }
  }
  
  if (otherOptions.output) {
    console.log(`✔ Individual summaries appended to ${otherOptions.output}`);
  }
}

/**
 * Generate a combined summary from multiple files
 */
async function generateCombinedSummary(summaries, cliConfig, otherOptions) {
  console.log(`\n🔄 Creating combined summary from ${summaries.length} files...`);
  
  // Create a summary of summaries
  const combinedContent = summaries.map(({ fileName, summary, tokens }) => {
    return `**${fileName}** (${tokens.toLocaleString()} tokens):\n${summary}`;
  }).join('\n\n---\n\n');
  
  const totalTokens = summaries.reduce((sum, { tokens }) => sum + tokens, 0);
  
  const prompt = `Please create a comprehensive overview summary from these individual file summaries. Focus on common themes, key insights, and overall patterns across all files:

Total files: ${summaries.length}
Total tokens processed: ${totalTokens.toLocaleString()}

${combinedContent}`;

  const combinedSummary = await askLLM(prompt, cliConfig);
  
  const block = `<!-- AI:summary -->\n${combinedSummary}\n<!-- /AI -->\n`;
  
  if (otherOptions.output) {
    const header = `\n\n## Combined Summary\n*${summaries.length} files processed* | *Total tokens: ${totalTokens.toLocaleString()}*\n\n${block}`;
    await fs.promises.appendFile(otherOptions.output, header);
    console.log(`✔ Combined summary appended to ${otherOptions.output}`);
  } else {
    console.log(`\n## Combined Summary`);
    console.log(`*${summaries.length} files processed* | *Total tokens: ${totalTokens.toLocaleString()}*`);
    console.log(block);
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
