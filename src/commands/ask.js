// src/commands/ask.js
import fs from "fs";
import { askLLM, askLLMStream } from "../core/llm.js";

export default async function ask(question, options = {}) {
  try {
    // Extract CLI config options
    const { provider, model, apiKey, baseUrl, stream, noStream, ...otherOptions } = options;
    const cliConfig = { provider, model, apiKey, baseUrl };
    
    let answer;
    let block;
    
    // Default to streaming for better user experience, unless --no-stream is specified
    const useStreaming = noStream ? false : (stream !== false);
    
    if (useStreaming) {
      // Use streaming response
      console.log(`💭 Question: ${question}\n`);
      answer = await askLLMStream(question, cliConfig);
      block = `<!-- AI:answer -->\n${answer}\n<!-- /AI -->\n`;
      
      // Add a newline for better formatting after streaming
      console.log('');
    } else {
      // Use regular response
      answer = await askLLM(question, cliConfig);
      block = `<!-- AI:answer -->\n${answer}\n<!-- /AI -->\n`;
      console.log(block);
    }

    if (otherOptions.output) {
      await fs.promises.appendFile(
        otherOptions.output,
        `\n\n## Question\n${question}\n\n${block}`
      );
      console.log(`✔ Answer appended to ${otherOptions.output}`);
    }
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}
