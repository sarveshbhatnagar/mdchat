// src/commands/config.js
import { setConfig, loadConfig } from "../core/config.js";
import readline from "readline";

/**
 * Fetch available Ollama models
 */
async function getOllamaModels(baseUrl = 'http://localhost:11434') {
  try {
    const response = await fetch(`${baseUrl}/api/tags`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return data.models.map(model => model.name);
  } catch (error) {
    console.log(`⚠️ Could not fetch Ollama models: ${error.message}`);
    return [];
  }
}

/**
 * Get the best available model from Ollama
 */
function getBestOllamaModel(models) {
  // Preference order: larger models first, then by name
  const preferences = [
    'llama3.1:70b', 'llama3.1:8b', 'llama3.2:3b', 'llama3.2:1b',
    'llama3:70b', 'llama3:8b',
    'codellama:34b', 'codellama:13b', 'codellama:7b',
    'mistral:7b', 'phi3:medium', 'phi3:mini'
  ];
  
  // Find exact matches first
  for (const preferred of preferences) {
    if (models.includes(preferred)) {
      return preferred;
    }
  }
  
  // Find partial matches (e.g., "llama3.2:latest" matches "llama3.2")
  for (const preferred of preferences) {
    const base = preferred.split(':')[0];
    const match = models.find(model => model.startsWith(base));
    if (match) {
      return match;
    }
  }
  
  // Return first available model if no preferred match
  return models[0] || 'llama3.2';
}

// Interactive setup function
async function setupInteractive() {
  console.log("🚀 Welcome to MDChat Setup!\n");
  
  try {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (prompt) => {
      return new Promise((resolve) => {
        rl.question(prompt, resolve);
      });
    };

    // Check if config already exists
    const existingConfig = loadConfig();
    if (Object.keys(existingConfig).length > 0) {
      console.log("⚠️  Existing configuration found:");
      for (const [k, v] of Object.entries(existingConfig)) {
        if (k === 'apiKey') {
          console.log(`   ${k}: ${v.substring(0, 8)}...`);
        } else {
          console.log(`   ${k}: ${v}`);
        }
      }
      
      const overwrite = await question("\nDo you want to overwrite this configuration? (y/N): ");
      if (!overwrite.toLowerCase().startsWith('y')) {
        console.log("Setup cancelled. Use 'mdchat config set <key> <value>' to update individual settings.");
        rl.close();
        return;
      }
      console.log("");
    }

  // Provider selection
  console.log("Which AI provider would you like to use?");
  console.log("1. OpenAI (GPT-4, GPT-3.5, etc.)");
  console.log("2. Anthropic (Claude)");
  console.log("3. Ollama (Local models)");
  
  let providerChoice;
  while (true) {
    providerChoice = await question("\nEnter your choice (1-3): ");
    if (['1', '2', '3'].includes(providerChoice)) break;
    console.log("❌ Please enter 1, 2, or 3");
  }

  let provider, defaultModel;
  switch (providerChoice) {
    case '1':
      provider = 'openai';
      defaultModel = 'gpt-4o';
      break;
    case '2':
      provider = 'anthropic';
      defaultModel = 'claude-3-5-sonnet-20241022';
      break;
    case '3':
      provider = 'ollama';
      // Fetch available models dynamically
      console.log("\n🔍 Checking available Ollama models...");
      const availableModels = await getOllamaModels();
      
      if (availableModels.length === 0) {
        console.log("❌ No Ollama models found. Make sure Ollama is running and has models installed.");
        console.log("💡 Install a model with: ollama pull llama3.2");
        rl.close();
        return;
      }
      
      // Get the best available model
      const bestModel = getBestOllamaModel(availableModels);
      
      if (availableModels.length === 1) {
        defaultModel = availableModels[0];
        console.log(`✅ Found model: ${defaultModel}`);
      } else {
        console.log(`\nAvailable models (${availableModels.length} found):`);
        availableModels.forEach((model, index) => {
          const isBest = model === bestModel;
          console.log(`${index + 1}. ${model}${isBest ? ' (recommended)' : ''}`);
        });
        
        const modelChoice = await question(`\nSelect a model (1-${availableModels.length}) or press Enter for recommended: `);
        
        if (modelChoice.trim() === '') {
          defaultModel = bestModel;
        } else {
          const choiceIndex = parseInt(modelChoice) - 1;
          if (choiceIndex >= 0 && choiceIndex < availableModels.length) {
            defaultModel = availableModels[choiceIndex];
          } else {
            console.log("Invalid choice, using recommended model.");
            defaultModel = bestModel;
          }
        }
      }
      break;
  }

  console.log(`\n✅ Selected: ${provider.charAt(0).toUpperCase() + provider.slice(1)}`);

  // API Key input (skip for Ollama since it's local)
  let apiKey = '';
  if (provider !== 'ollama') {
    console.log(`\nNow we need your ${provider.charAt(0).toUpperCase() + provider.slice(1)} API key.`);
    
    if (provider === 'openai') {
      console.log("💡 Get your API key from: https://platform.openai.com/api-keys");
    } else if (provider === 'anthropic') {
      console.log("💡 Get your API key from: https://console.anthropic.com/");
    }

    while (true) {
      apiKey = await question("\nEnter your API key: ");
      if (apiKey.trim()) {
        // Basic validation for API key formats
        if (provider === 'openai' && !apiKey.startsWith('sk-')) {
          console.log("⚠️ OpenAI API keys typically start with 'sk-'. Please double-check.");
        } else if (provider === 'anthropic' && !apiKey.startsWith('sk-ant-')) {
          console.log("⚠️ Anthropic API keys typically start with 'sk-ant-'. Please double-check.");
        }
        break;
      }
      console.log("❌ API key cannot be empty");
    }
  } else {
    console.log("\n💡 Make sure Ollama is running locally (ollama serve)");
    console.log("💡 You can install models with: ollama pull llama3.2");
    console.log("💡 Check available models with: ollama list");
  }

  // Save configuration
  console.log("\n🔧 Saving configuration...");
  
  setConfig('provider', provider);
  setConfig('model', defaultModel);
  
  if (apiKey) {
    setConfig('apiKey', apiKey);
  }

  // Set base URL for Ollama
  if (provider === 'ollama') {
    setConfig('baseUrl', 'http://localhost:11434');
  }

  console.log("\n🎉 Setup complete! Your configuration:");
  console.log(`   Provider: ${provider}`);
  console.log(`   Model: ${defaultModel}`);
  if (apiKey) {
    console.log(`   API Key: ${apiKey.substring(0, 8)}...`);
  }
  if (provider === 'ollama') {
    console.log(`   Base URL: http://localhost:11434`);
  }

  console.log("\n🚀 You're ready to use MDChat! Try:");
  console.log("   mdchat ask \"Hello, how are you?\"");
  console.log("\n💡 Tip: Use 'mdchat config list' to view your configuration anytime");
  console.log("💡 Tip: Use 'mdchat ask --help' to see all available options");

  rl.close();
  
  } catch (error) {
    console.error("❌ Setup failed:", error.message);
    process.exit(1);
  }
}

export default async function config(cmd, key, value) {
  if (cmd === "setup") {
    await setupInteractive();
    return;
  }

  if (cmd === "set") {
    if (!key || !value) {
      console.error("❌ Usage: mdchat config set <key> <value>");
      process.exit(1);
    }
    const updated = setConfig(key, value);
    console.log(`✔ Set ${key} = ${value}`);
    return updated;
  }

  if (cmd === "get") {
    if (!key) {
      console.error("❌ Usage: mdchat config get <key>");
      process.exit(1);
    }
    const config = loadConfig();
    if (config[key]) {
      console.log(`${key} = ${config[key]}`);
    } else {
      console.log(`⚠️ No value set for "${key}"`);
    }
    return config[key];
  }

  if (cmd === "list") {
    const config = loadConfig();
    console.log("Current config:");
    for (const [k, v] of Object.entries(config)) {
      console.log(`  ${k} = ${v}`);
    }
    return config;
  }

  console.error("❌ Unknown config command. Use: setup | set | get | list");
  process.exit(1);
}
