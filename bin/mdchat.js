#!/usr/bin/env node

import { program } from "commander";

program
  .name("mdchat")
  .description("Markdown Chat: LLM collaboration in your terminal")
  .version("0.1.0");

program
  .command("ask <question>")
  .description("Ask a question and insert AI output into Markdown")
  .action((question) => {
    console.log(`Q: ${question}`);
    console.log(`<!-- AI:answer -->\nThis is where the LLM answer goes\n<!-- /AI -->`);
  });

program.parse();
