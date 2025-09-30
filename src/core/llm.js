// src/core/llm.js
import fs from "fs";
import os from "os";
import path from "path";

const CONFIG_PATH = path.join(os.homedir(), ".mdchatrc");

/**
 * Load config from ~/.mdchatrc with CLI overrides
 * @param {Object} cliOptions - CLI options that can override config file
 */
function loadConfig(cliOptions = {}) {
  let config = {};
  
  // Try to load from config file
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    } catch (err) {
      console.error("❌ Error reading config file:", err.message);
    }
  }

  // Override with CLI options (convert kebab-case to snake_case)
  if (cliOptions.provider) config.provider = cliOptions.provider;
  if (cliOptions.model) config.model = cliOptions.model;
  if (cliOptions.apiKey) config.api_key = cliOptions.apiKey;
  if (cliOptions.baseUrl) config.base_url = cliOptions.baseUrl;

  // Validate required fields
  if (!config.provider) {
    throw new Error(`No provider configured. Run "mdchat config init" or use --provider option.`);
  }
  if (!config.model) {
    throw new Error(`No model configured. Run "mdchat config init" or use --model option.`);
  }
  if (config.provider !== "ollama" && !config.api_key) {
    throw new Error(`No API key configured. Run "mdchat config set api_key <key>" or use --api-key option.`);
  }

  return config;
}

/**
 * Ask an LLM using a simple HTTP request (placeholder implementation)
 * @param {string} prompt - User input
 * @param {Object} cliOptions - CLI options for config override
 * @returns {Promise<string>} - Generated text
 */
export async function askLLM(prompt, cliOptions = {}) {
  const { provider, model, api_key, base_url } = loadConfig(cliOptions);

  // For now, return a mock response to test the CLI configuration
  // TODO: Implement actual API calls once modelfusion import is fixed
  return `This is a mock response for "${prompt}" using ${provider}/${model}.\n\nConfiguration loaded:\n- Provider: ${provider}\n- Model: ${model}\n- API Key: ${api_key ? '***' : 'Not set'}\n- Base URL: ${base_url || 'Default'}`;
}
