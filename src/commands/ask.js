// src/commands/ask.js
import fs from "fs";
import { askLLM } from "../core/llm.js";

export default async function ask(question, options = {}) {
  try {
    // Extract CLI config options
    const { provider, model, apiKey, baseUrl, ...otherOptions } = options;
    const cliConfig = { provider, model, apiKey, baseUrl };
    
    const answer = await askLLM(question, cliConfig);

    const block = `<!-- AI:answer -->\n${answer}\n<!-- /AI -->\n`;

    if (otherOptions.output) {
      fs.appendFileSync(
        otherOptions.output,
        `\n\n## Question\n${question}\n\n${block}`
      );
      console.log(`✔ Answer appended to ${otherOptions.output}`);
    } else {
      console.log(block);
    }
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}
