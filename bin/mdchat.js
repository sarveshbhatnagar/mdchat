#!/usr/bin/env node

import { program } from "commander";
import ask from "../src/commands/ask.js";
import summarize from "../src/commands/summarize.js";
import edit, { listSections } from "../src/commands/edit.js";
import config from "../src/commands/config.js";

program
  .name("mdchat")
  .description("Markdown Chat: LLM collaboration in your terminal")
  .version("1.0.1");

// Global options for CLI-based config override
program
  .option("--provider <provider>", "LLM provider (openai, anthropic, ollama)")
  .option("--model <model>", "Model name")
  .option("--api-key <key>", "API key")
  .option("--base-url <url>", "Base URL for API (for custom endpoints)");

program
  .command("ask <question>")
  .description("Ask a question and insert AI output into Markdown")
  .option("-o, --output <file>", "Append output to a markdown file")
  .option("--no-stream", "Disable streaming and show complete response at once")
  .action(async (question, options) => {
    // Merge global options with command options
    const globalOptions = program.opts();
    const mergedOptions = { ...options, ...globalOptions };
    await ask(question, mergedOptions);
  });

program
  .command("summarize <input>")
  .description("Summarize content from files, directories, or text input")
  .option("-o, --output <file>", "Append summary to a markdown file")
  .option("--combine", "Create a combined summary when processing multiple files")
  .action(async (input, options) => {
    // Merge global options with command options
    const globalOptions = program.opts();
    const mergedOptions = { ...options, ...globalOptions };
    await summarize(input, mergedOptions);
  });

program
  .command("edit <file>")
  .description("Edit and improve markdown files with AI assistance")
  .option("-a, --action <action>", "Edit action: simplify, clarify, shorten, expand, improve, rewrite, fix", "improve")
  .option("-s, --section <section>", "Target specific section by header name")
  .option("-o, --output <file>", "Save edited content to a file")
  .option("--replace", "Replace the original file (creates backup)")
  .option("--instructions <text>", "Additional custom instructions for the AI")
  .action(async (file, options) => {
    // Merge global options with command options
    const globalOptions = program.opts();
    const mergedOptions = { ...options, ...globalOptions };
    await edit(file, mergedOptions);
  });

program
  .command("sections <file>")
  .description("List all sections in a markdown file")
  .action(async (file) => {
    await listSections(file);
  });

program
  .command("config")
  .argument("<cmd>", "set | get | list")
  .argument("[key]", "Config key")
  .argument("[value]", "Config value (if setting)")
  .action((cmd, key, value) => config(cmd, key, value));

program.parse();
